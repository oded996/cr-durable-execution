FROM node:20-slim
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --production --registry=https://registry.npmjs.org/
RUN npm install @google-cloud/functions-framework
COPY . .
RUN ls -R dist
# We'll use the original index.js which points to dist/examples/workflow
EXPOSE 8080
CMD [ "node", "node_modules/.bin/functions-framework", "--target=durableEventFunction", "--signature-type=http" ]
