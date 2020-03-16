FROM ubuntu:18.04

RUN apt-get update
# install nodeJS and npm.
RUN apt-get install -y \
        nodejs \
        curl \
        npm

# install yarn
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - \
    && echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list \
    && apt-get update && apt-get install -y yarn

# install kubectl
RUN apt-get update && apt-get install -y apt-transport-https
RUN curl -s https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key add -
RUN echo "deb https://apt.kubernetes.io/ kubernetes-xenial main" | tee -a /etc/apt/sources.list.d/kubernetes.list
RUN apt-get update
RUN apt-get install -y kubectl
ENV PATH $PWD/bin:$PATH

# copy ain-v1-worker code.
RUN mkdir /ain-connect-worker
ADD package.json /ain-connect-worker
ADD ./ /ain-connect-worker

WORKDIR /ain-connect-worker
RUN yarn

CMD ["yarn", "start"]