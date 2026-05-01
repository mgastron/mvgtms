# Multi-stage: build JAR and run (usar imagen con Maven+JDK17 para evitar apk add maven que trae OpenJDK25 y provoca SIGSEGV en Alpine)
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
# Evita crash SIGSEGV del JIT (C2) al compilar dentro de Docker en algunos hosts.
# Mantiene la compilación estable para builds repetidos en Mac + Docker Desktop.
ENV MAVEN_OPTS="-XX:TieredStopAtLevel=1 -Xmx1024m"
RUN mvn -B clean package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/tms-backend-1.0.0.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
