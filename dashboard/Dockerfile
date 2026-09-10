FROM nginx:1.27-alpine

# Sajikan dashboard statis + proxy Docker API via unix socket.
COPY dashboard/nginx.conf /etc/nginx/nginx.conf
COPY dashboard/index.html /usr/share/nginx/html/index.html
COPY dashboard/app.js /usr/share/nginx/html/app.js
COPY desired-state.json /usr/share/nginx/html/desired-state.json

EXPOSE 80
