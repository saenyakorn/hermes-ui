import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { createFormHook, createFormHookContexts } from "@tanstack/react-form";
import { Button } from "./Button";
import {
  Field as FieldPrimitive,
  FieldDescription as FieldDescriptionPrimitive,
  FieldError as FieldErrorPrimitive,
  FieldGroup,
  FieldLabel as FieldLabelPrimitive,
  Input as InputPrimitive,
  Textarea as TextareaPrimitive,
} from "./field";

const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts();

function Field(props: ComponentPropsWithoutRef<typeof FieldPrimitive>) {
  return <FieldPrimitive {...props} />;
}

function FieldLabel(props: ComponentPropsWithoutRef<typeof FieldLabelPrimitive>) {
  const field = useFieldContext<string>();
  return <FieldLabelPrimitive htmlFor={field.name} {...props} />;
}

function FieldDescription(props: ComponentPropsWithoutRef<typeof FieldDescriptionPrimitive>) {
  const field = useFieldContext<string>();
  if (!props.children) return null;
  return <FieldDescriptionPrimitive id={`${field.name}-description`} {...props} />;
}

function FieldError(props: Omit<ComponentPropsWithoutRef<typeof FieldErrorPrimitive>, "errors">) {
  const field = useFieldContext();
  return (
    <FieldErrorPrimitive id={`${field.name}-error`} errors={field.state.meta.errors} {...props} />
  );
}

function Input(props: ComponentPropsWithoutRef<typeof InputPrimitive>) {
  const field = useFieldContext<string>();
  return (
    <InputPrimitive
      {...formControl(field)}
      {...props}
      value={field.state.value}
      onChange={(event) => field.handleChange(event.target.value)}
    />
  );
}

function Textarea(props: ComponentPropsWithoutRef<typeof TextareaPrimitive>) {
  const field = useFieldContext<string>();
  return (
    <TextareaPrimitive
      {...formControl(field)}
      {...props}
      value={field.state.value}
      onChange={(event) => field.handleChange(event.target.value)}
    />
  );
}

function Form(props: ComponentPropsWithoutRef<"form">) {
  const form = useFormContext();
  return (
    <form
      {...props}
      id={form.formId}
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    />
  );
}

type SubmitButtonProps = ComponentPropsWithoutRef<typeof Button> & {
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  isLoading?: boolean;
};

function SubmitButton({
  leftIcon,
  rightIcon,
  isLoading: isLoadingProp,
  children,
  ...props
}: SubmitButtonProps) {
  const form = useFormContext();
  return (
    <form.Subscribe
      selector={(state) => state.isSubmitting}
      children={(isSubmitting) => {
        const isLoading = isLoadingProp ?? isSubmitting;
        return (
          <Button
            {...props}
            type="submit"
            form={form.formId}
            disabled={isLoading || props.disabled}
          >
            {isLoading ? "Saving..." : leftIcon}
            {children}
            {isLoading ? null : rightIcon}
          </Button>
        );
      }}
    />
  );
}

type FormControlField = {
  name: string;
  handleBlur: () => void;
  state: {
    meta: {
      errors: ReadonlyArray<unknown>;
      isTouched: boolean;
      isValid: boolean;
    };
  };
};

function formControl(field: FormControlField) {
  const describedBy = [`${field.name}-description`];
  if (field.state.meta.errors.length > 0) {
    describedBy.push(`${field.name}-error`);
  }

  return {
    id: field.name,
    name: field.name,
    onBlur: field.handleBlur,
    "aria-invalid": field.state.meta.isTouched && !field.state.meta.isValid,
    "aria-describedby": describedBy.join(" "),
  };
}

const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    Field,
    FieldLabel,
    FieldDescription,
    FieldError,
    Input,
    Textarea,
  },
  formComponents: {
    Form,
    SubmitButton,
    FieldGroup,
  },
});

export {
  fieldContext,
  formContext,
  formControl,
  useAppForm,
  useFieldContext,
  useFormContext,
  withForm,
};
