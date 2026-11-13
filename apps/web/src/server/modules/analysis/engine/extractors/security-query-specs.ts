export const SECURITY_QUERY_SPECS: Partial<Record<string, string>> = {
  ".cjs": `
    (call_expression function: (identifier) @sink.name (#match? @sink.name "^(eval|Function|exec|execSync|spawn|spawnSync)$")) @sink.call
    (call_expression function: (member_expression object: (identifier) @sink.object property: (property_identifier) @sink.method) (#match? @sink.object "^(child_process|vm)$")) @sink.call
  `,
  ".js": `
    (call_expression function: (identifier) @sink.name (#match? @sink.name "^(eval|Function|exec|execSync|spawn|spawnSync)$")) @sink.call
    (call_expression function: (member_expression object: (identifier) @sink.object property: (property_identifier) @sink.method) (#match? @sink.object "^(child_process|vm)$")) @sink.call
    (assignment_expression left: (member_expression property: (property_identifier) @sink.property) (#match? @sink.property "^(innerHTML|outerHTML)$")) @sink.call
  `,
  ".jsx": `
    (call_expression function: (identifier) @sink.name (#match? @sink.name "^(eval|Function|exec|execSync|spawn|spawnSync)$")) @sink.call
    (jsx_attribute (property_identifier) @sink.attr (#match? @sink.attr "^dangerouslySetInnerHTML$")) @sink.call
  `,
  ".ts": `
    (call_expression function: (identifier) @sink.name (#match? @sink.name "^(eval|Function|exec|execSync|spawn|spawnSync)$")) @sink.call
    (call_expression function: (member_expression object: (identifier) @sink.object property: (property_identifier) @sink.method) (#match? @sink.object "^(child_process|vm)$")) @sink.call
    (assignment_expression left: (member_expression property: (property_identifier) @sink.property) (#match? @sink.property "^(innerHTML|outerHTML)$")) @sink.call
  `,
  ".tsx": `
    (call_expression function: (identifier) @sink.name (#match? @sink.name "^(eval|Function|exec|execSync|spawn|spawnSync)$")) @sink.call
    (call_expression function: (member_expression object: (identifier) @sink.object property: (property_identifier) @sink.method) (#match? @sink.object "^(child_process|vm)$")) @sink.call
    (jsx_attribute (property_identifier) @sink.attr (#match? @sink.attr "^dangerouslySetInnerHTML$")) @sink.call
  `,
};
