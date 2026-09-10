FROM nginx:1.27-alpine

ARG APP_NAME=app
ARG APP_VERSION=dev

ENV APP_NAME=$APP_NAME \
    APP_VERSION=$APP_VERSION

COPY index.html /usr/share/nginx/html/index.html

EXPOSE 80
