/**
 * E2E fixture module (copied into every generated demo plugin as notes.js): the "Notes" custom page of
 * tests/fixtures/notes-page.php. `#/notes` lists the notes through the plugin's own REST route (`request`), `#/notes/new`
 * and `#/notes/<id>` edit one with Fyldo's `Form`. Deliberately small: e2e/wp/custom-page.spec.ts drives it.
 */
export default function notes({ React, ui, Form }) {
  const h = React.createElement;

  function List({ page, props, navigate, request, headingRef }) {
    const [items, setItems] = React.useState(null);
    React.useEffect(() => {
      let live = true;
      request(props.rest).then((data) => live && setItems(data.items));
      return () => {
        live = false;
      };
    }, [request, props.rest]);

    return h(
      'div',
      null,
      h(ui.PageHeader, {
        title: page.title,
        description: page.description,
        headingRef,
        actions: h(ui.Button, { variant: 'primary', size: 'sm', onClick: () => navigate('new') }, 'New note'),
      }),
      items === null
        ? h('p', { role: 'status' }, 'Loading notes…')
        : items.length === 0
          ? h(ui.EmptyState, { icon: 'document-text', title: 'No notes yet' })
          : h(
              'ul',
              { 'aria-label': 'Notes' },
              items.map((item) =>
                h('li', { key: item.id }, h('a', { href: `#/notes/${item.id}` }, item.title), item.done ? ' (done)' : null),
              ),
            ),
    );
  }

  function Editor({ path, navigate, toast, headingRef }) {
    const record = path[0];
    return h(
      'div',
      null,
      h(ui.PageHeader, {
        title: record === 'new' ? 'New note' : 'Edit note',
        headingRef,
        actions: h(ui.Button, { variant: 'secondary', size: 'sm', onClick: () => navigate([]) }, 'All notes'),
      }),
      h(Form, {
        form: 'note',
        record,
        onSaved: (key) => {
          if (record === 'new') {
            toast.success('Note created');
            navigate([key], { replace: true });
          }
        },
      }),
    );
  }

  return { Component: (props) => (props.path.length > 0 ? h(Editor, props) : h(List, props)) };
}
