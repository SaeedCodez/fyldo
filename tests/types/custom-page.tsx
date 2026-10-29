/** A custom page in TSX, as docs/custom-pages.md#typescript shows it: checked against the bundled declarations. */
import type {
  ButtonProps,
  CustomPageExport,
  CustomPageProps,
  DateRangeValue,
  FieldBindings,
  FieldKind,
  FieldValue,
  FormApi,
  FormProps,
  FyldoSdk,
  GroupItemStatus,
  MediaItem,
  PageLink,
  RequestOptions,
  SelectProps,
  SettingRowProps,
} from 'fyldo';

interface Story {
  id: number;
  title: string;
}

const stories: CustomPageExport = ({ React, ui, Form, useForm, iconSvg }: FyldoSdk) => {
  function Editor({
    record,
    headingRef,
    navigate,
    toast,
  }: { record: string } & Pick<CustomPageProps, 'headingRef' | 'navigate' | 'toast'>) {
    const form = useForm({
      form: 'story',
      record,
      onSaved: (key) => navigate([key], { replace: true }),
    });
    const [svg, setSvg] = React.useState('');
    React.useEffect(() => {
      void iconSvg('heart', { size: 20, label: 'Heart' }).then((markup: string) => setSvg(markup));
    }, []);
    return (
      <form.Frame>
        <ui.PageHeader
          title="Story"
          headingRef={headingRef}
          actions={<ui.Button onClick={() => void form.save()}>Save</ui.Button>}
        />
        {/* `field(id, kind)`: the props of that kind of control, typed, so they spread as they are. */}
        <ui.Input size="md" {...form.field('title', 'text')} />
        <ui.Toggle {...form.field('pinned', 'toggle')} />
        <ui.IconPicker size="md" icons={['star', 'heart', 'flash']} aria-label="Icon" {...form.field('icon', 'text')} />
        {/* `iconSvg`: one icon's markup, for drawing outside React (here only to use the value). */}
        <span dangerouslySetInnerHTML={{ __html: svg }} />
        <ui.MultiSelect size="md" options={[]} {...form.field('tags', 'list')} />
        <ui.MediaPicker
          kind="image"
          label="Cover"
          onError={(message) => toast.error(message)}
          {...form.field('cover', 'media')}
        />
      </form.Frame>
    );
  }

  function Stories({ page, path, navigate, request, toast, headingRef }: CustomPageProps) {
    const [items, setItems] = React.useState<Story[]>([]);
    React.useEffect(() => {
      request<Story[]>('acme/v1/stories').then(setItems, () =>
        toast.error('Could not load the stories', {
          action: { label: 'Retry', onClick: () => navigate('') },
        }),
      );
    }, [request, toast, navigate]);

    if (path[0] === 'new')
      return <Form form="story" record="new" onSaved={(key) => navigate(key)} />;
    if (path[0] !== undefined)
      return <Editor record={path[0]} headingRef={headingRef} navigate={navigate} toast={toast} />;
    return (
      <>
        <ui.PageHeader title={page.title} description={page.description} headingRef={headingRef} />
        {items.map((story) => (
          <ui.Badge key={story.id}>{story.title}</ui.Badge>
        ))}
      </>
    );
  }

  return { Component: Stories };
};

export default stories;

/** The 1.x contract: the names the d.ts exports, Fyldo's own props, one-argument callbacks. */
export function contract(sdk: FyldoSdk, form: FormApi, links: PageLink[], options: RequestOptions): React.ReactElement {
  const { React, ui } = sdk;
  const version: string = sdk.fyldoVersion;
  const hasGroupList = 'GroupList' in ui;
  const value: FieldValue = form.values.title ?? null;
  const media: MediaItem | null = form.field('cover', 'media').media;
  const range: DateRangeValue = form.field('when', 'range').value;
  const kind: FieldKind = 'list';
  const list: FieldBindings['list'] = form.field('tags', kind);
  const status: GroupItemStatus[] = [{ label: 'Scheduled', tone: 'blue', icon: 'clock' }];
  const props: FormProps = { form: 'story', record: 'new' };
  const button: ButtonProps = { variant: 'secondary', className: 'acme', onClick: () => undefined };
  const select: SelectProps = { options: [], value: '', onValueChange: (next: string) => void next, onBlur: () => undefined };
  const row: SettingRowProps = { title: 'Body', width: 'wide', children: null };
  const valid: boolean = form.validate() && form.validate('slides.2.link');
  void [version, hasGroupList, value, media, range, list, status, props, links, options, valid];

  return (
    <>
      <ui.Button {...button} />
      <ui.Select {...select} />
      <ui.SettingRow {...row} />
      <ui.Input value="" onValueChange={(next) => void next.toUpperCase()} />
      <ui.Toggle onCheckedChange={(on) => void (on === true)} />
      <ui.Tabs tabs={[]} value="" onValueChange={() => undefined} aria-label="Status">
        {() => null}
      </ui.Tabs>
      <ui.Pagination page={1} pageCount={2} onPageChange={() => undefined} aria-label="Stories pages" />
      <ui.Modal open={false} onOpenChange={() => undefined} tone="danger" title="Delete?" cancelLabel="Cancel" confirmLabel="Delete" onConfirm={() => undefined} />
      <ui.DateRangePicker value={range} onValueChange={() => undefined} aria-label="Period" />
      <ui.GroupItem title="One" open={false} onOpenChange={() => undefined} status={status}>
        {null}
      </ui.GroupItem>
      {/* @ts-expect-error Base UI's `render` is not part of Fyldo's props. */}
      <ui.Button render={<a />} />
      {/* @ts-expect-error A Setting Row's width is `width`, not a boolean. */}
      <ui.SettingRow title="Body" wide>
        {null}
      </ui.SettingRow>
      {/* @ts-expect-error `variant` is Fyldo's own (a group's sub-field), not public. */}
      <ui.SettingRow title="Body" variant="item">
        {null}
      </ui.SettingRow>
      {/* @ts-expect-error `className` is a string, not a function of Base UI's state. */}
      <ui.Checkbox className={() => 'x'} />
    </>
  );
}
