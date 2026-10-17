/** A custom field in TSX, as docs/custom-fields.md#typescript shows it: checked against the bundled declarations. */
import type { CustomFieldExport, CustomFieldProps, JsonValue } from 'fyldo';

const workingHours: CustomFieldExport = ({ React, ui }) => {
  function WorkingHours({
    value,
    onChange,
    onBlur,
    disabled,
    labelledBy,
    describedBy,
    props,
  }: CustomFieldProps) {
    const [opens = '', closes = ''] = typeof value === 'string' ? value.split('-') : [];
    const times = Array.isArray(props.times) ? props.times.map(String) : [];
    const options = times.map((time) => ({ value: time, label: time }));
    const pick = (a: string, b: string): void => {
      onChange(`${a}-${b}`);
      onBlur();
    };
    const [count, setCount] = React.useState(0);

    return (
      <div role="group" aria-labelledby={labelledBy} aria-describedby={describedBy}>
        <ui.Select
          size="md"
          options={options}
          value={opens}
          aria-label="Opens"
          disabled={disabled}
          onValueChange={(v) => pick(v, closes)}
        />
        <ui.Select
          size="md"
          options={options}
          value={closes}
          aria-label="Closes"
          disabled={disabled}
          onValueChange={(v) => pick(opens, v)}
        />
        <ui.Button variant="secondary" onClick={() => setCount(count + 1)}>
          {count}
        </ui.Button>
        <ui.Toggle checked={count > 0} onCheckedChange={(checked) => setCount(checked ? 1 : 0)} />
      </div>
    );
  }

  return {
    Component: WorkingHours,
    validate: (value: JsonValue) => (value === '' ? 'Pick both times' : null),
  };
};

export default workingHours;

/** A definition without the SDK: plain DOM. */
export const plain: CustomFieldExport = {
  mount(element, props) {
    element.textContent = String(props.value);
    return {
      update: (next) => void (element.textContent = String(next.value)),
      destroy: () => element.replaceChildren(),
    };
  },
};

// @ts-expect-error A definition needs a Component or a mount of the right shape.
export const wrong: CustomFieldExport = { Component: 42 };
