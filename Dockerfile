FROM node:20-slim

# Install hermes CLI (mocking for now as we don't have the binary, 
# but in real scenario this would install the actual hermes tool)
# For now, let's create a mock hermes script in /usr/local/bin
RUN echo '#!/bin/bash\necho "Hermes Mock Gateway Started"\nsleep infinity' > /usr/local/bin/hermes \
    && chmod +x /usr/local/bin/hermes

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server/index.js"]
