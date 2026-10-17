/**
 * The demo's custom page (docs/custom-pages.md): a list of announcements and an editor for one, drawn by this module
 * inside Fyldo's screen. Plain JavaScript with no build step: React, Fyldo's components (`ui`) and its form engine
 * (`Form`) come from the default export's argument, so nothing here loads a second React or redraws a Fyldo control.
 *
 * Routes: `#/announcements` is the list, `#/announcements/new` and `#/announcements/42` the editor. The records live
 * in the demo's own table (demo/announcements.php): the list talks to the demo's REST routes through `request`, the
 * editor is a Fyldo form whose `load` / `save` callbacks read and write that table.
 */
export default function announcements({ React, ui, Form }) {
  const h = React.createElement;
  const { useEffect, useMemo, useRef, useState } = React;

  const TONE = { published: 'green', draft: 'gray', archived: 'amber' };
  const STATUSES = ['all', 'published', 'draft', 'archived'];

  /** `sprintf` for the translated strings PHP hands over: `%s` and `%1$s`. */
  const format = (text, ...args) => {
    let next = 0;
    return text.replace(/%(?:(\d+)\$)?s/g, (_, n) => String(args[n ? Number(n) - 1 : next++] ?? ''));
  };

  /** The value, once it stopped changing for `ms` (the search field asks the server after the user pauses). */
  function useDebounced(value, ms) {
    const [settled, setSettled] = useState(value);
    useEffect(() => {
      const timer = setTimeout(() => setSettled(value), ms);
      return () => clearTimeout(timer);
    }, [value, ms]);
    return settled;
  }

  function List({ page, props, locale, navigate, request, toast, headingRef }) {
    const t = props.text;
    const lang = locale.replace('_', '-');
    const number = useMemo(() => new Intl.NumberFormat(lang), [lang]);
    // A Persian page gets the Persian calendar from Intl itself (fa-IR).
    const day = useMemo(() => new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric' }), [lang]);

    const [status, setStatus] = useState('all');
    const [search, setSearch] = useState('');
    const query = useDebounced(search.trim(), 300);
    const [orderby, setOrderby] = useState('newest');
    const [paged, setPaged] = useState(1);
    const [reload, setReload] = useState(0);
    const [state, setState] = useState({ loading: true, error: false, data: null });
    const [doomed, setDoomed] = useState(null);
    const [deleteImage, setDeleteImage] = useState(false);
    const lastDoomed = useRef(null);
    if (doomed) lastDoomed.current = doomed;

    // Another tab, word or order starts again at page 1.
    useEffect(() => setPaged(1), [status, query, orderby]);

    useEffect(() => {
      const controller = new AbortController();
      setState((current) => ({ ...current, loading: true, error: false }));
      request(props.rest, { query: { status, search: query, orderby, paged }, signal: controller.signal })
        .then((data) => setState({ loading: false, error: false, data }))
        .catch(() => {
          if (!controller.signal.aborted) setState((current) => ({ ...current, loading: false, error: true }));
        });
      return () => controller.abort();
    }, [request, props.rest, status, query, orderby, paged, reload]);

    const refresh = () => setReload((n) => n + 1);

    const duplicate = (item) =>
      request(`${props.rest}/${item.id}/duplicate`, { method: 'POST' })
        .then(() => {
          toast.success(t.duplicated);
          refresh();
        })
        .catch(() => toast.error(t.actionFailed));

    const remove = async () => {
      const item = doomed;
      if (!item) return;
      try {
        await request(`${props.rest}/${item.id}`, { method: 'DELETE', query: { delete_image: deleteImage ? 1 : 0 } });
        toast.success(t.deleted);
        // The last card of a page: go back one page instead of showing an empty one.
        if (state.data && state.data.items.length === 1 && paged > 1) setPaged(paged - 1);
        else refresh();
      } catch {
        toast.error(t.actionFailed);
      }
      setDoomed(null);
    };

    const ends = (item) => {
      if (!item.endsAt) return t.always;
      const date = new Date(item.endsAt);
      return date.getTime() < Date.now() ? t.ended : format(t.until, day.format(date));
    };

    const viewsLabel = (views) => {
      const [before, after] = t.views.split('%s');
      return h(
        React.Fragment,
        null,
        before ? h('span', { className: 'fyldo-demo-ann-sr' }, before) : null,
        number.format(views),
        after ? h('span', { className: 'fyldo-demo-ann-sr' }, after) : null,
      );
    };

    const data = state.data;
    const counts = data ? data.counts : null;
    const filtered = query !== '';

    const card = (item) =>
      h(ui.ItemCard, {
        key: item.id,
        title: item.title,
        description: item.message || undefined,
        media: item.image
          ? h('img', { src: item.image, alt: '', className: 'fyldo-demo-ann-image' })
          : h('span', { className: 'fyldo-demo-ann-placeholder' }, h(ui.Icon, { name: 'notification-bing', size: 24 })),
        status: h(ui.Badge, { tone: TONE[item.status], size: 'sm' }, t[item.status]),
        flag: item.pinned ? h(ui.Badge, { tone: 'gray', size: 'sm' }, t.pinned) : undefined,
        details: [
          { icon: 'clock', label: ends(item) },
          // The number only, as in the design; screen readers hear "1,240 views".
          { icon: 'chart-21', label: viewsLabel(item.views) },
        ],
        actions: [
          h(ui.IconButton, { key: 'edit', icon: 'edit-2', label: t.edit, variant: 'tertiary', size: 'sm', onClick: () => navigate([item.id]) }),
          h(ui.IconButton, { key: 'copy', icon: 'copy', label: t.duplicate, variant: 'tertiary', size: 'sm', onClick: () => void duplicate(item) }),
          h(ui.IconButton, {
            key: 'delete',
            icon: 'trash',
            label: t.delete,
            variant: 'tertiary',
            size: 'sm',
            onClick: () => {
              setDeleteImage(false);
              setDoomed(item);
            },
          }),
        ],
        onOpen: () => navigate([item.id]),
      });

    const body = () => {
      if (state.error && !data)
        return h(ui.Notice, { tone: 'red', action: h(ui.Button, { variant: 'secondary', size: 'sm', onClick: refresh }, t.retry) }, t.loadError);
      if (!data) return h('p', { role: 'status', className: 'fyldo-demo-ann-status' }, t.loading);
      if (counts.all === 0)
        return h(ui.EmptyState, {
          icon: 'notification-bing',
          title: t.emptyTitle,
          description: t.emptyDescription,
          primaryAction: h(ui.Button, { variant: 'primary', size: 'sm', leadingIcon: 'add', onClick: () => navigate('new') }, t.add),
        });

      const from = (paged - 1) * props.perPage + 1;
      return h(
        'div',
        { className: 'fyldo-demo-ann-list', 'aria-busy': state.loading || undefined },
        h(
          'div',
          { className: 'fyldo-demo-ann-toolbar' },
          h(ui.Input, {
            className: 'fyldo-demo-ann-search',
            size: 'sm',
            prefixIcon: 'search-normal',
            type: 'search',
            value: search,
            placeholder: t.search,
            'aria-label': t.search,
            onChange: (event) => setSearch(event.target.value),
          }),
          h(ui.Select, {
            className: 'fyldo-demo-ann-sort',
            size: 'sm',
            value: orderby,
            'aria-label': t.sortLabel,
            onValueChange: setOrderby,
            options: [
              { value: 'newest', label: t.newest },
              { value: 'oldest', label: t.oldest },
              { value: 'title', label: t.byTitle },
            ],
          }),
        ),
        state.error ? h(ui.Notice, { tone: 'red', action: h(ui.Button, { variant: 'secondary', size: 'sm', onClick: refresh }, t.retry) }, t.loadError) : null,
        data.items.length === 0
          ? h(ui.EmptyState, {
              size: 'sm',
              icon: 'search-normal',
              title: t.noResults,
              description: t.noResultsHint,
              secondaryAction: filtered ? h(ui.Button, { variant: 'secondary', size: 'sm', onClick: () => setSearch('') }, t.clearSearch) : undefined,
            })
          : h(
              'div',
              { className: 'fyldo-demo-ann-grid' },
              data.items.map(card),
              // The Add card closes the grid of the unfiltered list only.
              !filtered && status === 'all' ? h(ui.AddItemCard, { key: 'add', title: t.add, description: t.addDescription, onClick: () => navigate('new') }) : null,
            ),
        h(ui.Pagination, {
          page: paged,
          pageCount: data.pages,
          onPageChange: setPaged,
          summary: format(t.showing, number.format(from), number.format(Math.min(from + props.perPage - 1, data.total)), number.format(data.total)),
        }),
      );
    };

    return h(
      'div',
      { className: 'fyldo-demo-ann' },
      h(ui.PageHeader, {
        title: page.title,
        description: page.description,
        headingRef,
        actions: h(ui.Button, { variant: 'primary', size: 'sm', leadingIcon: 'add', onClick: () => navigate('new') }, t.add),
      }),
      counts
        ? h(
            'div',
            { className: 'fyldo-demo-ann-stats' },
            h(ui.StatCard, { label: t.statTotal, value: number.format(counts.all), icon: 'notification-bing' }),
            h(ui.StatCard, { label: t.statPublished, value: number.format(counts.published), icon: 'tick-circle' }),
            h(ui.StatCard, { label: t.statDrafts, value: number.format(counts.draft), icon: 'edit-2' }),
            h(ui.StatCard, { label: t.statViews, value: number.format(data.views), icon: 'chart-21', comparison: t.statViewsHint }),
          )
        : null,
      h(ui.Tabs, {
        tabs: STATUSES.map((id) => ({ id, label: t[id], badge: counts ? number.format(counts[id]) : undefined })),
        value: status,
        onValueChange: setStatus,
        label: t.tabsLabel,
        locale,
        children: body,
      }),
      h(
        ui.Modal,
        {
          open: doomed !== null,
          onOpenChange: (open) => {
            if (!open) setDoomed(null);
          },
          type: 'danger',
          title: format(t.deleteTitle, lastDoomed.current ? lastDoomed.current.title : ''),
          description: t.deleteDescription,
          cancelLabel: t.cancel,
          confirmLabel: t.delete,
          onConfirm: remove,
        },
        lastDoomed.current && lastDoomed.current.image
          ? h(ui.Checkbox, { label: t.deleteImage, description: t.deleteImageHint, checked: deleteImage, onCheckedChange: (checked) => setDeleteImage(checked === true) })
          : null,
      ),
    );
  }

  function Editor({ path, props, dir, navigate, toast, headingRef }) {
    const t = props.text;
    const record = path[0];
    return h(
      'div',
      { className: 'fyldo-demo-ann' },
      h(ui.PageHeader, {
        title: record === 'new' ? t.newTitle : t.editTitle,
        description: t.editDescription,
        headingRef,
        actions: h(
          ui.Button,
          { variant: 'secondary', size: 'sm', leadingIcon: dir === 'rtl' ? 'arrow-right' : 'arrow-left', onClick: () => navigate([]) },
          t.back,
        ),
      }),
      h(Form, {
        form: 'announcement',
        record,
        onSaved: (key) => {
          // A new record has a key now: the URL names it, without a history entry for "new".
          if (record === 'new') {
            toast.success(t.created);
            navigate([key], { replace: true });
          }
        },
      }),
    );
  }

  function AnnouncementsPage(props) {
    return props.path.length > 0 ? h(Editor, props) : h(List, props);
  }

  return { Component: AnnouncementsPage };
}
