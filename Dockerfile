FROM node:12.16.1-alpine AS build

# copy server code.
RUN npm install -g npm
RUN mkdir /server
WORKDIR /server
ADD package.json /server
ADD ./tsconfig.json /server/tsconfig.json
RUN npm install 
RUN npm install -g typescript
ADD ./src /server/src
RUN tsc

FROM node:12.16.1-slim

RUN apt-get update
RUN apt-get install -y curl

# install kubectl
RUN apt-get update && apt-get install -y apt-transport-https python3 gnupg make g++
RUN curl -s https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key add -
RUN echo "deb https://apt.kubernetes.io/ kubernetes-xenial main" | tee -a /etc/apt/sources.list.d/kubernetes.list
RUN apt-get update
RUN apt-get install -y kubectl
ENV PATH $PWD/bin:$PATH
RUN mkdir /root/.kube

RUN mkdir /server
ADD package.json /server
ADD ./kube_yaml /server/kube_yaml
COPY --from=build /server/dist /server/dist
WORKDIR /server
RUN npm install --only=prod

CMD ["node", "dist/index.js", "start"]