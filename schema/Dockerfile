FROM maven:3.8.1-openjdk-16-slim AS maven
WORKDIR app

COPY pom.xml .
COPY src src

RUN mvn package

ENTRYPOINT ["java", "-cp", "target/test-shacl-1.0.0-SNAPSHOT-jar-with-dependencies.jar", "TestShacl"]
