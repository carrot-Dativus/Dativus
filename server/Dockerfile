# ── Stage 1: Gradle 빌드 ───────────────────────────────
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /workspace

COPY gradle gradle
COPY gradlew build.gradle settings.gradle ./
RUN chmod +x gradlew && ./gradlew dependencies --no-daemon -q

COPY src src
RUN ./gradlew bootJar --no-daemon -x test

# ── Stage 2: 경량 런타임 ────────────────────────────────
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /workspace/build/libs/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-Dspring.profiles.active=prod", "-jar", "app.jar"]
