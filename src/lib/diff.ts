type Severity = "breaking" | "warning" | "info";

type OperationRef = {
  path: string;
  method: string;
  operation: Record<string, unknown>;
  pathItem: Record<string, unknown>;
};

export type DiffItem = {
  severity: Severity;
  code: string;
  message: string;
  operation?: {
    path: string;
    method: string;
  };
};

export type DiffResult = {
  summary: {
    breaking: number;
    warning: number;
    info: number;
    total: number;
  };
  items: DiffItem[];
};

const HTTP_METHODS = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "options",
  "head",
  "trace",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeMethod(method: string): string {
  return method.toUpperCase();
}

function getOperations(spec: Record<string, unknown>): Map<string, OperationRef> {
  const operations = new Map<string, OperationRef>();
  const paths = spec.paths as Record<string, Record<string, unknown>> | undefined;
  if (!paths) {
    return operations;
  }

  Object.entries(paths).forEach(([path, pathItem]) => {
    if (!pathItem || typeof pathItem !== "object") return;
    HTTP_METHODS.forEach((method) => {
      const operation = (pathItem as Record<string, unknown>)[method];
      if (operation && typeof operation === "object") {
        const key = `${normalizeMethod(method)} ${path}`;
        operations.set(key, {
          path,
          method: normalizeMethod(method),
          operation: operation as Record<string, unknown>,
          pathItem: pathItem as Record<string, unknown>,
        });
      }
    });
  });

  return operations;
}

function getResponses(operation: Record<string, unknown>): Set<string> {
  const responses = operation.responses as Record<string, unknown> | undefined;
  if (!responses) {
    return new Set();
  }
  return new Set(Object.keys(responses));
}

function extractSchema(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;
  const schema = value.schema;
  return isRecord(schema) ? schema : undefined;
}

function getSchemaFromContent(content: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!content) return undefined;
  const jsonEntry = content["application/json"];
  const jsonSchema = extractSchema(jsonEntry);
  if (jsonSchema) return jsonSchema;

  const jsonLikeKey = Object.keys(content).find((key) => key.endsWith("+json") || key.includes("json"));
  if (jsonLikeKey) {
    const schema = extractSchema(content[jsonLikeKey]);
    if (schema) return schema;
  }

  const firstEntry = Object.values(content)[0];
  return extractSchema(firstEntry);
}

function getRequestSchema(operation: Record<string, unknown>): Record<string, unknown> | undefined {
  const requestBody = operation.requestBody as Record<string, unknown> | undefined;
  if (!requestBody) return undefined;
  const content = requestBody.content as Record<string, unknown> | undefined;
  return getSchemaFromContent(content);
}

function getResponseSchemas(operation: Record<string, unknown>): Map<string, Record<string, unknown>> {
  const responses = operation.responses as Record<string, unknown> | undefined;
  const result = new Map<string, Record<string, unknown>>();
  if (!responses) return result;
  Object.entries(responses).forEach(([status, response]) => {
    if (!isRecord(response)) return;
    const content = response.content as Record<string, unknown> | undefined;
    const schema = getSchemaFromContent(content);
    if (schema) {
      result.set(status, schema);
    }
  });
  return result;
}

function getRequiredParams(pathItem: Record<string, unknown>, operation: Record<string, unknown>): Set<string> {
  const params: Array<Record<string, unknown>> = [];
  const pathParams = pathItem.parameters as Array<Record<string, unknown>> | undefined;
  const opParams = operation.parameters as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(pathParams)) {
    params.push(...pathParams);
  }
  if (Array.isArray(opParams)) {
    params.push(...opParams);
  }

  const required = new Set<string>();
  params.forEach((param) => {
    if (!param || typeof param !== "object") return;
    const name = String(param.name || "");
    const location = String(param.in || "");
    if (!name || !location) return;
    const isRequired = Boolean(param.required) || location === "path";
    if (isRequired) {
      required.add(`${location}:${name}`);
    }
  });
  return required;
}

function isRequestBodyRequired(operation: Record<string, unknown>): boolean {
  const requestBody = operation.requestBody as Record<string, unknown> | undefined;
  if (!requestBody) return false;
  return Boolean(requestBody.required);
}

function getEnumValues(schema: Record<string, unknown>): Set<string> | null {
  const raw = schema.enum;
  if (!Array.isArray(raw)) return null;
  return new Set(raw.map((value) => JSON.stringify(value)));
}

function getRequiredFields(schema: Record<string, unknown>): Set<string> {
  const raw = schema.required;
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.map((value) => String(value)));
}

type ObjectShape = {
  properties: Record<string, Record<string, unknown>>;
};

function getObjectShape(schema: Record<string, unknown>): ObjectShape | null {
  const properties: Record<string, Record<string, unknown>> = {};
  const allOf = schema.allOf;
  if (Array.isArray(allOf)) {
    allOf.forEach((entry) => {
      if (!isRecord(entry)) return;
      const shape = getObjectShape(entry);
      if (!shape) return;
      Object.assign(properties, shape.properties);
    });
  }

  if (isRecord(schema.properties)) {
    Object.entries(schema.properties).forEach(([key, value]) => {
      if (isRecord(value)) {
        properties[key] = value;
      }
    });
  }

  if (Object.keys(properties).length === 0) {
    return null;
  }

  return { properties };
}

function getSchemaContext(schemaPath: string): "request" | "response" | "other" {
  if (schemaPath.startsWith("request.")) return "request";
  if (schemaPath.startsWith("response.")) return "response";
  return "other";
}

function compareSchema(
  baseSchema: Record<string, unknown>,
  headSchema: Record<string, unknown>,
  schemaPath: string,
  items: DiffItem[],
  ref: OperationRef,
  visitedBase: WeakSet<object>,
  visitedHead: WeakSet<object>,
) {
  if (visitedBase.has(baseSchema) || visitedHead.has(headSchema)) return;
  visitedBase.add(baseSchema);
  visitedHead.add(headSchema);

  const baseType = String(baseSchema.type || "");
  const headType = String(headSchema.type || "");
  if (baseType && headType && baseType !== headType) {
    addItem(
      items,
      "breaking",
      "schema-type-changed",
      `Type changed at ${schemaPath} (${baseType} -> ${headType})`,
      ref
    );
    return;
  }

  const baseEnum = getEnumValues(baseSchema);
  const headEnum = getEnumValues(headSchema);
  if (baseEnum || headEnum) {
    const baseValues = baseEnum ? [...baseEnum].sort() : [];
    const headValues = headEnum ? [...headEnum].sort() : [];
    const removedValues = baseValues.filter((value) => !headEnum?.has(value));
    const addedValues = headValues.filter((value) => !baseEnum?.has(value));
    if (removedValues.length > 0 || addedValues.length > 0) {
      const details: string[] = [];
      if (removedValues.length > 0) {
        details.push(`removed: ${removedValues.join(", ")}`);
      }
      if (addedValues.length > 0) {
        details.push(`added: ${addedValues.join(", ")}`);
      }
      const suffix = details.length > 0 ? ` (${details.join("; ")})` : "";
      addItem(
        items,
        "breaking",
        "schema-enum-changed",
        `Enum changed at ${schemaPath}${suffix}`,
        ref
      );
    }
  }

  const baseItems = isRecord(baseSchema.items) ? baseSchema.items : undefined;
  const headItems = isRecord(headSchema.items) ? headSchema.items : undefined;
  if (baseType === "array" || headType === "array" || baseItems || headItems) {
    if (baseItems && headItems) {
      compareSchema(baseItems, headItems, `${schemaPath}[]`, items, ref, visitedBase, visitedHead);
    }
  }

  const baseShape = getObjectShape(baseSchema);
  const headShape = getObjectShape(headSchema);
  if (baseShape && headShape) {
    const context = getSchemaContext(schemaPath);
    const baseRequired = getRequiredFields(baseSchema);
    const headRequired = getRequiredFields(headSchema);
    headRequired.forEach((key) => {
      if (baseRequired.has(key)) return;
      const severity = context === "request" ? "warning" : "info";
      addItem(items, severity, "schema-required-added", `New required field ${schemaPath}.${key}`, ref);
    });

    Object.entries(baseShape.properties).forEach(([key, baseProp]) => {
      const headProp = headShape.properties[key];
      if (!headProp) {
        addItem(items, "breaking", "schema-field-removed", `Removed field ${schemaPath}.${key}`, ref);
        return;
      }
      compareSchema(baseProp, headProp, `${schemaPath}.${key}`, items, ref, visitedBase, visitedHead);
    });

    Object.entries(headShape.properties).forEach(([key]) => {
      if (baseShape.properties[key]) return;
      if (context === "response") {
        addItem(items, "info", "schema-field-added", `Added field ${schemaPath}.${key}`, ref);
      }
    });
  }
}

function addItem(items: DiffItem[], severity: Severity, code: string, message: string, ref?: OperationRef) {
  items.push({
    severity,
    code,
    message,
    operation: ref ? { path: ref.path, method: ref.method } : undefined,
  });
}

export function diffSpecs(baseSpec: Record<string, unknown>, headSpec: Record<string, unknown>): DiffResult {
  const items: DiffItem[] = [];
  const baseOps = getOperations(baseSpec);
  const headOps = getOperations(headSpec);

  baseOps.forEach((baseOp, key) => {
    if (!headOps.has(key)) {
      addItem(items, "breaking", "operation-removed", `Removed operation ${key}`, baseOp);
    }
  });

  headOps.forEach((headOp, key) => {
    if (!baseOps.has(key)) {
      addItem(items, "info", "operation-added", `Added operation ${key}`, headOp);
    }
  });

  baseOps.forEach((baseOp, key) => {
    const headOp = headOps.get(key);
    if (!headOp) return;

    const baseResponses = getResponses(baseOp.operation);
    const headResponses = getResponses(headOp.operation);

    baseResponses.forEach((status) => {
      if (!headResponses.has(status)) {
        addItem(items, "breaking", "response-removed", `Removed response ${status} for ${key}`, baseOp);
      }
    });

    headResponses.forEach((status) => {
      if (!baseResponses.has(status)) {
        addItem(items, "info", "response-added", `Added response ${status} for ${key}`, headOp);
      }
    });

    const baseRequiredParams = getRequiredParams(baseOp.pathItem, baseOp.operation);
    const headRequiredParams = getRequiredParams(headOp.pathItem, headOp.operation);
    headRequiredParams.forEach((param) => {
      if (!baseRequiredParams.has(param)) {
        addItem(items, "warning", "required-param-added", `New required parameter ${param} for ${key}`, headOp);
      }
    });

    const baseBodyRequired = isRequestBodyRequired(baseOp.operation);
    const headBodyRequired = isRequestBodyRequired(headOp.operation);
    if (!baseBodyRequired && headBodyRequired) {
      addItem(items, "warning", "request-body-required", `Request body is now required for ${key}`, headOp);
    }

    const baseRequestSchema = getRequestSchema(baseOp.operation);
    const headRequestSchema = getRequestSchema(headOp.operation);
    if (baseRequestSchema && headRequestSchema) {
      compareSchema(
        baseRequestSchema,
        headRequestSchema,
        "request.body",
        items,
        headOp,
        new WeakSet(),
        new WeakSet(),
      );
    }

    const baseResponseSchemas = getResponseSchemas(baseOp.operation);
    const headResponseSchemas = getResponseSchemas(headOp.operation);
    baseResponseSchemas.forEach((baseSchema, status) => {
      const headSchema = headResponseSchemas.get(status);
      if (!headSchema) return;
      compareSchema(
        baseSchema,
        headSchema,
        `response.${status}.body`,
        items,
        headOp,
        new WeakSet(),
        new WeakSet(),
      );
    });
  });

  const summary = {
    breaking: items.filter((item) => item.severity === "breaking").length,
    warning: items.filter((item) => item.severity === "warning").length,
    info: items.filter((item) => item.severity === "info").length,
    total: items.length,
  };

  return { summary, items };
}
