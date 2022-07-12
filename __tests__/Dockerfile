#syntax=docker/dockerfile:1.4
FROM golang AS build

RUN mkdir -p /myapp
RUN touch /myapp/main.go

FROM ubuntu AS config

RUN touch /myapp.config

FROM alpine:3.14
COPY --from=config --link /myapp.config /etc/
COPY --from=build --link /myapp /bin/
ENTRYPOINT ["/bin/myapp"]
