import { Component as ReactComponent, useEffect, useRef, type ErrorInfo, type ReactElement, type ReactNode } from 'react';
import { __ } from '../../i18n';
import { Icon } from '../../icons/Icon';
import { customDefinition, type CustomFieldDefinition, type CustomFieldMountHandle, type CustomFieldProps } from '../../lib/custom-fields';
import type { CustomFieldDef, FieldValue, JsonValue } from '../../types';
import { useGroupLabels } from '../ui/group-field';

export interface CustomControlProps {
  field: CustomFieldDef;
  value: FieldValue;
  onChange: (value: JsonValue) => void;
  onBlur: () => void;
  disabled: boolean;
  invalid: boolean;
  locale: string;
}

/** Said in place of a control whose module could not be loaded, or that crashed. The rest of the page works. */
function Unavailable(): ReactElement {
  return (
    <p data-slot="fy-custom-unavailable" className="fy:flex fy:items-start fy:gap-1.5 fy:text-copy-13 fy:text-status-error-text">
      <Icon name="info-circle" size={16} className="fy:mt-px" />
      <span>{__('This field could not be loaded.', 'fyldo')}</span>
    </p>
  );
}

/** A crash in the developer's component stays inside its row. */
class Boundary extends ReactComponent<{ id: string; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(`Fyldo: custom field "${this.props.id}" crashed.`, error, info.componentStack);
  }

  override render(): ReactNode {
    return this.state.failed ? <Unavailable /> : this.props.children;
  }
}

/** Plain-DOM path: `mount` once, `update` on every new set of props, `destroy` when the field goes away. */
function Mounted({ mount, props }: { mount: NonNullable<CustomFieldDefinition['mount']>; props: CustomFieldProps }): ReactElement {
  const element = useRef<HTMLDivElement>(null);
  const handle = useRef<CustomFieldMountHandle | void>(undefined);
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    const host = element.current;
    if (!host) return undefined;
    // The callbacks always reach the latest props: the module may keep the ones it got at mount.
    handle.current = mount(host, {
      ...latest.current,
      onChange: (value) => latest.current.onChange(value),
      onBlur: () => latest.current.onBlur(),
    });
    return () => {
      handle.current?.destroy?.();
      handle.current = undefined;
      host.replaceChildren();
    };
  }, [mount]);

  useEffect(() => {
    handle.current?.update?.(props);
  });

  return <div ref={element} data-slot="fy-custom-mount" />;
}

/** The control of a `custom` field, inside its Setting Row (which names it as a group: see useGroupLabels). */
export function CustomControl({ field, value, onChange, onBlur, disabled, invalid, locale }: CustomControlProps): ReactElement {
  const labels = useGroupLabels();
  const definition = customDefinition(field.module);
  if (!definition) return <Unavailable />;

  const props: CustomFieldProps = {
    value: (value ?? null) as JsonValue,
    onChange,
    onBlur,
    disabled,
    invalid,
    labelledBy: labels['aria-labelledby'] ?? '',
    describedBy: labels['aria-describedby'],
    props: field.props,
    field: { id: field.id, label: field.label, description: field.description },
    locale,
  };

  const { Component, mount } = definition;
  return (
    <Boundary id={field.id}>
      <div data-slot="fy-custom">
        {Component ? <Component {...props} /> : mount ? <Mounted mount={mount} props={props} /> : null}
      </div>
    </Boundary>
  );
}
