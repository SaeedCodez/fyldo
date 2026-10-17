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
  }: { record: string } & Pick<CustomPageProps, 'headingRef' | 'navigate'>) {
    const form = useForm({
      form: 'story',
      record,
      onSaved: (key) => navigate([key], { replace: true }),
    });
    const title = form.values.title;
    // `field(id)` is typed as the union of its shapes (by field type): narrow it, or bind the value yourself.
    const pinned = form.field('pinned');
    return (
      <form.Frame>
        <ui.PageHeader
          title="Story"
          headingRef={headingRef}
          actions={<ui.Button onClick={() => void form.save()}>Save</ui.Button>}
        />
        <ui.Input
          size="md"
          value={typeof title === 'string' ? title : ''}
          onValueChange={(v) => form.set('title', v)}
          onBlur={() => form.validate('title')}
        />
        {'checked' in pinned && <ui.Toggle {...pinned} />}
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
      return <Editor record={path[0]} headingRef={headingRef} navigate={navigate} />;
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
