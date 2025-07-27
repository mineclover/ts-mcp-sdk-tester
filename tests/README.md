# MCP Server Test Suite

Comprehensive test suite for the MCP Server covering data flow, logging, tracing, and SignOz integration.

## Test Structure

### 🔄 Data Flow Tests (`data-flow.test.ts`)
Tests the complete data flow architecture documented in `docs/architecture-flow.md`:

- **Normal Operation Flow**: Complete lifecycle from startup to shutdown
- **Shutdown During Initialization**: Edge case handling
- **HTTP Session Management**: Session lifecycle and cleanup
- **Error Recovery**: Multi-layer error handling
- **State Management**: Lifecycle state transitions
- **Performance Characteristics**: Memory and response time validation

### 📝 Logging System Tests (`logging-system.test.ts`)
Tests the RFC 5424 compliant logging system from `docs/logging-system.md`:

- **Severity Levels**: All 8 RFC 5424 levels (debug → emergency)
- **Structured Logging**: JSON object handling and string messages
- **Specialized Methods**: Method tracing, endpoint logging, error handling
- **Sensitive Data Filtering**: Automatic detection and filtering
- **Rate Limiting**: Flood protection and critical level exemption
- **Session Context**: Integration with session tracking
- **Trace Context**: Integration with distributed tracing
- **Performance**: Timing and memory management
- **Configuration**: Dynamic level changes and feature toggles

### 🔍 SignOz Tracing Tests (`signoz-tracing.test.ts`)
Tests the SignOz integration documented in `docs/signoz-integration.md`:

- **Initialization**: Config validation and conditional setup
- **Span Management**: Creation, lifecycle, and attributes
- **MCP Endpoint Tracing**: Specialized MCP operation tracing
- **Session Correlation**: Session context in traces
- **Business Events**: Custom event recording
- **Metrics Collection**: Counters, timers, and custom metrics
- **HTTP Integration**: Trace context propagation
- **Advanced Features**: Nested spans and async operations
- **Error Handling**: Span errors and recovery
- **Performance**: Concurrent spans and memory management

### 🌐 SignOz Endpoint Tests (`signoz-endpoint.test.ts`)
Tests actual connectivity to SignOz at `http://localhost:4317/`:

- **Health Checks**: Endpoint accessibility verification
- **Data Transmission**: Valid trace and metrics data
- **MCP Integration**: Real telemetry from MCP operations
- **High-Volume Testing**: Concurrent operations and batching
- **Manual Verification**: UI inspection instructions
- **Troubleshooting**: Configuration and environment validation

### 🔗 Integration Tests (`integration.test.ts`)
Tests complete end-to-end scenarios combining all systems:

- **Complete HTTP Flow**: Request → MCP → Response with full observability
- **MCP Protocol Flow**: Initialize → Operating → Requests with traces
- **Error Scenarios**: Error propagation through all layers
- **Session Lifecycle**: Complete session with observability
- **Performance Monitoring**: Metrics collection and reporting
- **Security Events**: Sensitive data filtering in action
- **Distributed Tracing**: Complex multi-component operations
- **Shutdown Sequence**: Graceful shutdown with cleanup tracking
- **Real-world Scenarios**: Complete MCP workflows

## Running Tests

### Prerequisites

1. **Bun Runtime**:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. **SignOz (for endpoint tests)**:
   ```bash
   git clone https://github.com/SigNoz/signoz.git
   cd signoz/deploy
   docker compose -f docker/clickhouse-setup/docker-compose.yaml up -d
   ```

3. **Dependencies**:
   ```bash
   bun install
   ```

### Test Commands

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/data-flow.test.ts
bun test tests/logging-system.test.ts
bun test tests/signoz-tracing.test.ts
bun test tests/signoz-endpoint.test.ts
bun test tests/integration.test.ts

# Run tests with verbose output
bun test --verbose

# Run tests in watch mode
bun test --watch

# Run tests with coverage (if configured)
bun test --coverage
```

### Environment Variables

For SignOz integration tests:

```bash
# Required for SignOz endpoint tests
export SIGNOZ_ENDPOINT=http://localhost:4318
export OTEL_SERVICE_NAME=mcp-test-server
export SIGNOZ_TRACES_ENABLED=true
export SIGNOZ_METRICS_ENABLED=true

# Optional
export OTEL_SERVICE_VERSION=1.0.0
export NODE_ENV=test
export SIGNOZ_LOGS_ENABLED=false
```

## Test Results and Verification

### 1. Data Flow Validation
- ✅ All lifecycle states transition correctly
- ✅ HTTP sessions managed properly
- ✅ Error recovery works across layers
- ✅ Performance characteristics meet targets

### 2. Logging System
- ✅ All 8 RFC 5424 severity levels work
- ✅ Structured logging preserves data structure
- ✅ Sensitive data automatically filtered
- ✅ Rate limiting prevents log flooding
- ✅ Trace context propagated to logs

### 3. SignOz Integration
- ✅ Spans created with proper attributes
- ✅ MCP operations traced end-to-end
- ✅ Session correlation works
- ✅ Metrics collected and exported
- ✅ Error scenarios handled gracefully

### 4. Endpoint Connectivity
- ✅ SignOz endpoints accessible
- ✅ Valid telemetry data accepted
- ✅ High-volume operations supported
- ✅ Real-time data transmission verified

### 5. Integration Testing
- ✅ Complete request flows with observability
- ✅ Multi-component trace correlation
- ✅ Security event tracking
- ✅ Performance monitoring active
- ✅ Graceful shutdown with cleanup

## Manual Verification

### SignOz UI Inspection

1. **Open SignOz UI**: http://localhost:3301
2. **Check Services**: Look for test services in Services tab
3. **Inspect Traces**: Click service → view trace details
4. **Verify Attributes**: Check span attributes and hierarchy
5. **Monitor Metrics**: View custom metrics in Metrics tab

### Expected Services in SignOz
- `test-service`
- `mcp-endpoint-test`
- `integration-test-server`
- `mcp-test-server`

### Expected Trace Operations
- `endpoint.connectivity.test`
- `mcp.tools/call`
- `mcp.resources/read`
- `session.create`
- `business.operation`
- `volume/test/*`

## Troubleshooting

### Common Issues

1. **SignOz Not Running**:
   ```bash
   cd signoz/deploy
   docker compose -f docker/clickhouse-setup/docker-compose.yaml up -d
   ```

2. **Port Conflicts**:
   - SignOz UI: 3301
   - SignOz OTLP HTTP: 4318
   - SignOz OTLP gRPC: 4317
   - Test HTTP server: 3001-3003

3. **Test Failures**:
   - Check environment variables
   - Verify SignOz accessibility
   - Review test output for specific errors

### Debug Mode

Enable detailed logging during tests:

```bash
# Enable debug logging
export OTEL_LOG_LEVEL=debug
export DEBUG=mcp:*
bun test --verbose
```

### Performance Issues

Monitor test performance:

```bash
# Run with timing
time bun test

# Memory usage monitoring
bun test --heap-prof
```

## Test Coverage

The test suite covers:

- ✅ **Data Flow**: All documented scenarios from architecture-flow.md
- ✅ **Logging**: Complete RFC 5424 implementation from logging-system.md
- ✅ **Tracing**: Full OpenTelemetry integration from tracing-guide.md
- ✅ **SignOz**: Real integration with SignOz from signoz-integration.md
- ✅ **Integration**: End-to-end workflows combining all systems
- ✅ **Performance**: Resource usage and response time validation
- ✅ **Security**: Sensitive data filtering and security event tracking
- ✅ **Error Handling**: Comprehensive error scenarios and recovery

## Contributing

### Adding New Tests

1. **Choose the right test file**:
   - Data flow: `data-flow.test.ts`
   - Logging: `logging-system.test.ts`
   - Tracing: `signoz-tracing.test.ts`
   - Integration: `integration.test.ts`

2. **Follow naming conventions**:
   - Descriptive test names
   - Group related tests in describe blocks
   - Use async/await for asynchronous operations

3. **Include verification**:
   - Assert expected outcomes
   - Verify observability data (logs, traces, metrics)
   - Check error scenarios

4. **Document new tests**:
   - Update this README
   - Add inline comments for complex scenarios
   - Reference relevant documentation

### Test Data Management

- Use deterministic test data when possible
- Clean up resources in `afterEach`/`afterAll`
- Mock external dependencies except for integration tests
- Use realistic but safe data for security tests

This comprehensive test suite ensures the MCP Server's observability system works correctly across all documented scenarios and provides confidence in production deployments.