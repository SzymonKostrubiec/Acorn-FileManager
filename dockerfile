FROM ubuntu:latest

RUN apt-get update && apt-get install -y \
    git \
    build-essential \
    cmake \
    wget \
    curl \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Pobieramy i kompilujemy Squirrel ze źródła
RUN git clone https://github.com/albertodemichelis/squirrel.git /squirrel \
    && cd /squirrel \
    && cmake . \
    && make \
    && make install \
    && ldconfig

WORKDIR /file-manager

CMD ["sq"]
