/**
 * Project ESLint rules that keep the design system honest (docs/ARCHITECTURE.md §8):
 *  - fyldo/no-hex-colors        components use tokens, never literal colours
 *  - fyldo/no-arbitrary-values  Tailwind classes use the scale/tokens, not `w-[320px]`
 *  - fyldo/portal-container     every Base UI Portal renders INSIDE the Fyldo root (scoped tokens + reset)
 */
const HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/i;

const stringsIn = (node) => {
  if (node.type === 'Literal' && typeof node.value === 'string') return [node.value];
  if (node.type === 'TemplateLiteral') return node.quasis.map((q) => q.value.cooked ?? '');
  return [];
};

export default {
  rules: {
    'no-hex-colors': {
      meta: { type: 'problem', schema: [], messages: { hex: 'Use a design token instead of the literal colour "{{value}}".' } },
      create: (context) => ({
        Literal(node) {
          if (typeof node.value === 'string' && HEX.test(node.value)) context.report({ node, messageId: 'hex', data: { value: node.value } });
        },
        TemplateElement(node) {
          if (HEX.test(node.value.cooked ?? '')) context.report({ node, messageId: 'hex', data: { value: node.value.cooked } });
        },
      }),
    },

    'no-arbitrary-values': {
      meta: { type: 'problem', schema: [], messages: { arbitrary: 'Arbitrary Tailwind value "{{value}}": use the spacing scale or a token.' } },
      create: (context) => {
        const check = (node) => {
          for (const text of stringsIn(node)) {
            for (const token of text.split(/\s+/)) {
              if (!token.startsWith('fy:')) continue;
              // Variants (which may legitimately use brackets: data-[…], has-[…]) end at the last ':'.
              const utility = token.slice(token.lastIndexOf(':') + 1);
              if (/-\[[^\]]*\]/.test(utility)) context.report({ node, messageId: 'arbitrary', data: { value: token } });
            }
          }
        };
        return { Literal: check, TemplateLiteral: check };
      },
    },

    'portal-container': {
      meta: { type: 'problem', schema: [], messages: { missing: '`{{name}}` must receive `container` (see usePortalContainer) so popups render inside the Fyldo root.' } },
      create: (context) => ({
        JSXOpeningElement(node) {
          const name = node.name;
          const isPortal = name.type === 'JSXMemberExpression' && name.property.name === 'Portal';
          if (!isPortal) return;
          const has = node.attributes.some((a) => a.type === 'JSXAttribute' && a.name.name === 'container');
          if (!has) context.report({ node, messageId: 'missing', data: { name: `${name.object.name}.Portal` } });
        },
      }),
    },
  },
};
