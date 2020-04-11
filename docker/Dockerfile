FROM ubuntu:18.04

RUN apt -y update && \
	apt -y upgrade && \
	apt install -y \
	gnupg \
	wget \
	nodejs

RUN wget -qO - https://www.mongodb.org/static/pgp/server-4.2.asc | apt-key add -

RUN echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu bionic/mongodb-org/4.2 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-4.2.list && \
	apt update && \
	apt install -y mongodb-org

