# Jenkins controller for the nightly regression (jenkins/docker-compose.yml, see Jenkinsfile).
# Builds run scripts/test-docker.sh, which needs the Docker CLI + compose (talking to the dind
# service) and host Node from .nvmrc to read package-lock.json.
# Build context is the repo root; Dockerfile.dockerignore lets only .nvmrc in.
ARG JENKINS_TAG=lts-jdk21
FROM jenkins/jenkins:${JENKINS_TAG}

USER root

# Docker CLI, compose and buildx plugins (no daemon: DOCKER_HOST points to dind)
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
  && install -m 0755 -d /etc/apt/keyrings \
  && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
  && . /etc/os-release \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $VERSION_CODENAME stable" \
    > /etc/apt/sources.list.d/docker.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin docker-buildx-plugin \
  && rm -rf /var/lib/apt/lists/*

# Node (major version from .nvmrc), fail if NodeSource installed another major
COPY .nvmrc /tmp/.nvmrc
RUN NODE_MAJOR=$(tr -d ' \nv' < /tmp/.nvmrc) \
  && curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/* \
  && installed=$(node -p 'process.versions.node.split(".")[0]') \
  && if [ "$installed" != "$NODE_MAJOR" ]; then \
    echo "node $installed installed, .nvmrc wants $NODE_MAJOR" >&2; exit 1; \
  fi

USER jenkins

RUN jenkins-plugin-cli --plugins \
  git \
  workflow-aggregator \
  docker-workflow \
  junit \
  htmlpublisher \
  credentials-binding \
  timestamper \
  ws-cleanup
