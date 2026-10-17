/** A custom page in TSX, as docs/custom-pages.md#typescript shows it: checked against the bundled declarations. */
import type { CustomPageExport, CustomPageProps, FyldoSdk } from 'fyldo';

interface Story {
  id: number;
  title: string;
}

const stories: CustomPageExport = ({ React, ui, Form, useForm }: FyldoSdk) => {
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
