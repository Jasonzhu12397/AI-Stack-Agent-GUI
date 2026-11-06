# =========================================================================
# AI Agent Studio - 100% Pure Golang Production Containerfile
# Base: Golang 1.22 Alpine -> Alpine 3.19 (Static Binary < 20MB)
# =========================================================================

FROM golang:1.22-alpine AS builder

WORKDIR /app
COPY go.mod ./
COPY . ./

# Compile statically linked binary with stripped symbols
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /app/agent-studio-go-server ./cmd/server

# Minimal production image
FROM alpine:3.19
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /app

COPY --from=builder /app/agent-studio-go-server /app/agent-studio-go-server

ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/api/v1/health || exit 1

ENTRYPOINT ["/app/agent-studio-go-server"]
