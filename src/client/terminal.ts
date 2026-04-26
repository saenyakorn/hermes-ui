import { FitAddon } from '@xterm/addon-fit';
import { io } from 'socket.io-client';
import { Terminal } from 'xterm';

const terminalElement = document.querySelector<HTMLElement>('#terminal');

if (terminalElement) {
  const terminal = new Terminal({
    cursorBlink: true,
    fontFamily: '"Azeret Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 13,
    theme: {
      background: '#000000',
      foreground: '#ffffff',
      cursor: '#0099ff',
      selectionBackground: '#0099ff55',
    },
  });
  const fit = new FitAddon();
  terminal.loadAddon(fit);
  terminal.open(terminalElement);
  fit.fit();

  const socket = io({
    transports: ['websocket'],
  });

  terminal.onData((input) => {
    socket.emit('terminal:input', input);
  });

  socket.on('connect', () => {
    terminal.writeln('\r\n[connected]\r\n');
    socket.emit('terminal:start');
    socket.emit('terminal:resize', { cols: terminal.cols, rows: terminal.rows });
  });

  socket.on('terminal:output', (data: string) => {
    terminal.write(data);
  });

  socket.on('terminal:exit', ({ exitCode }: { exitCode: number }) => {
    terminal.writeln(`\r\n[process exited ${exitCode}]\r\n`);
  });

  window.addEventListener('resize', () => {
    fit.fit();
    socket.emit('terminal:resize', { cols: terminal.cols, rows: terminal.rows });
  });

  document.querySelector<HTMLButtonElement>('#terminal-clear')?.addEventListener('click', () => {
    terminal.clear();
  });
}
