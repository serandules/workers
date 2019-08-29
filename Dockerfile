# use an official node runtime as a parent image
FROM node:10

ARG ENV
ARG GITHUB_USERNAME
ARG GITHUB_PASSWORD

# set the working directory to /srv/www/workers
WORKDIR /srv/www/workers

# update apt
RUN apt update

# install app dependencies
# a wildcard is used to ensure both package.json AND package-lock.json are copied where available (npm@5+)
COPY package*.json ./

# install logrotate
RUN apt install -y logrotate
COPY .logrotate /etc/logrotate.d/workers

# install filebeat
RUN curl -L -O https://artifacts.elastic.co/downloads/beats/filebeat/filebeat-6.3.2-amd64.deb
RUN dpkg -i filebeat-6.3.2-amd64.deb
COPY .filebeat.yml /etc/filebeat/filebeat.yml
RUN chmod go-w /etc/filebeat/filebeat.yml


# configure logz.io
RUN mkdir -p /etc/pki/tls/certs
RUN wget https://raw.githubusercontent.com/logzio/public-certificates/master/COMODORSADomainValidationSecureServerCA.crt -P /etc/pki/tls/certs

RUN npm install --only=production

# bundle app source
COPY . .

# install models
RUN node install.js

# make port 80 available to the world outside this container
EXPOSE 8000

# start server when the container launches
CMD ["startup.sh"]
