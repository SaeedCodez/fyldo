/**
 * Fyldo 1.0.0-beta.7: types of the module SDK, for custom fields and custom pages written in TypeScript.
 * Generated from app/sdk-types.ts by `npm run types` (part of `npm run build`); do not edit. Needs @types/react 19.
 * docs/custom-fields.md#typescript
 */
import * as React$1 from 'react';
import { AriaAttributes, ButtonHTMLAttributes, CSSProperties, ClipboardEventHandler, ComponentPropsWithoutRef, ComponentType, FocusEvent as FocusEvent$1, HTMLAttributes, HTMLInputTypeAttribute, ReactElement, ReactNode, Ref } from 'react';

/** The value of a range field: both ends in the single type's stored format; nothing = both ''. */
export type DateRangeValue = {
	start: string;
	end: string;
};
interface GroupItemValue {
	[subFieldId: string]: FieldValue;
}
/** What a `custom` field may hold: any JSON value (PHP cleans it, src/Fields/CustomField.php). */
export type JsonValue = string | number | boolean | null | JsonValue[] | {
	[key: string]: JsonValue;
};
export type FieldValue = string | boolean | string[] | number | null | GroupItemValue[] | JsonValue;
type NoticeTone = "gray" | "blue" | "green" | "amber" | "red";
type CodeLanguage = "css" | "html" | "json" | "text";
/** What the browser draws for a saved attachment (PHP: AbstractMediaField::media). The name, size and type come from the attachment, never from its URL. */
export interface MediaItem {
	id: number;
	filename: string;
	/** Bytes; 0 = unknown. */
	filesize: number;
	mime: string;
	/** Lower case, without the dot. */
	extension: string;
	width: number | null;
	height: number | null;
	/** An image field's thumbnail; null for a file or an image without one. */
	thumbnail: string | null;
	/** A video's or an audio file's length in seconds, as WordPress read it; null (or absent) for anything else or unknown. */
	duration?: number | null;
}
export interface FormProps {
	/** The id of a form registered in PHP. */
	form: string;
	/** The record's key, or 'new' for one that does not exist yet. */
	record: string;
	/** After every save: the record's key (the new one after creating it) and its stored values. */
	onSaved?: (key: string, values: Record<string, FieldValue>) => void;
}
type Load = {
	status: "loading";
} | {
	status: "ready";
} | {
	status: "missing";
} | {
	status: "failed";
	message: string;
};
declare function Form({ form, record, onSaved }: FormProps): React$1.ReactElement;
/**
 * The props of each kind of control, with the value in the control's own type (`field(id, kind)`): spread one onto its
 * control (`<ui.Input {...form.field('title', 'text')} />`) with no narrowing in TypeScript.
 */
export interface FieldBindings {
	/** `ui.Input`, `Textarea`, `Select`, `RadioGroup`, `SegmentedControl`, `ChoiceCards`, `ColorPicker`, `IconPicker`, `DatePicker`, `TimePicker`, `CodeEditor`: not a string = ''. */
	text: {
		value: string;
		onValueChange: (value: string) => void;
		onBlur: () => void;
		disabled: boolean;
	};
	/** `ui.NumberInput` (a number, or the text being typed): neither = ''. */
	number: {
		value: number | string;
		onValueChange: (value: number | string) => void;
		onBlur: () => void;
		disabled: boolean;
	};
	/** `ui.MultiSelect`: the strings of the list; not a list = []. */
	list: {
		value: string[];
		onValueChange: (value: string[]) => void;
		onBlur: () => void;
		disabled: boolean;
	};
	/** `ui.DateRangePicker`: each end a string; a missing end = ''. */
	range: {
		value: DateRangeValue;
		onValueChange: (value: DateRangeValue) => void;
		onBlur: () => void;
		disabled: boolean;
	};
	/** `ui.Toggle`, `Checkbox`: on or off; anything but `true` = off. */
	toggle: {
		checked: boolean;
		onCheckedChange: (checked: boolean) => void;
		disabled: boolean;
	};
	/** `ui.MediaPicker`: the attachment ID (not a number = 0), the attachment it draws, and its change. */
	media: {
		value: number;
		media: MediaItem | null;
		onValueChange: (value: number, item: MediaItem | null) => void;
		onBlur: () => void;
		disabled: boolean;
	};
}
/** A kind of control `field(id, kind)` binds. */
export type FieldKind = keyof FieldBindings;
type FieldBinding = 
/** `toggle`, `checkbox`: on or off. */
FieldBindings["toggle"]
/** `image`, `file`: `ui.MediaPicker`'s value, the attachment it draws, and its change. */
 | FieldBindings["media"]
/** Every other type: the value and its change, and blur (the moment Fyldo's fields check a value). */
 | {
	value: FieldValue;
	onValueChange: (value: FieldValue) => void;
	onBlur: () => void;
	disabled: boolean;
};
/** A record form whose page draws the fields itself (the SDK's `useForm`); Fyldo keeps loading, checking and saving. */
export interface FormApi {
	/** `loading` (the defaults are in `values`), `ready`, `missing` (no such record) or `failed` (`Frame` says why). */
	status: Load["status"];
	/** Every field's current value: the record's, with this session's edits, and the defaults while it loads. */
	values: Record<string, FieldValue>;
	/** Every message, keyed by field id or by a path inside a value (`slides.2.link`). */
	errors: Readonly<Record<string, string>>;
	/** The message of a field or a path, if any. */
	error: (path: string) => string | undefined;
	/** How many messages a field or a path holds, its own and those inside it (a Group Item's `errorCount`). */
	errorCount: (path: string) => number;
	/**
	 * Whether a field shows for the current values (its `dependency`, and its section's): draw it only then. A hidden field
	 * is neither checked nor saved. `<group>.<index>.<sub-field>` asks about a sub-field of one item.
	 */
	visible: (path: string) => boolean;
	/** There are unsaved edits. */
	dirty: boolean;
	saving: boolean;
	/** Counts the saves refused for invalid values: open the items that hold errors when it grows. */
	invalidSaves: number;
	/** Set a field's value. `clear`: the message keys the edit makes stale (default: all of the field's). */
	set: (id: string, value: FieldValue, options?: {
		clear?: string[];
	}) => void;
	/**
	 * Props for the control of field `id`: by its type, or with `kind`, the props of that kind of control, its value in
	 * the control's type (TypeScript then needs no narrowing). A kind that does not match the field's type is reported.
	 */
	field: {
		(id: string): FieldBinding;
		<K extends FieldKind>(id: string, kind: K): FieldBindings[K];
	};
	/**
	 * Check now, as on blur, and return whether it is valid: a field (`title`), the part of a field at a path
	 * (`slides.2`, `slides.2.link`: the messages at or under it), or, without a path, every field that is enabled and shown.
	 */
	validate: (path?: string) => boolean;
	/** Check every field, then save the record; false when it was refused or failed (the Save Bar says why). */
	save: () => Promise<boolean>;
	discard: () => void;
	/** Draws what surrounds the page's fields: the load and conflict notices, the Save Bar, Ctrl/⌘+S, focus on the first invalid control. */
	Frame: React$1.ComponentType<{
		children?: React$1.ReactNode;
	}>;
}
declare function useRecordForm({ form, record, onSaved }: FormProps): FormApi;
/**
 * A link drawn as a button: a utility link (Documentation, Help & support) in the sidebar footer or the Top Navigation,
 * and a page's own links in its Page Header (`page.links` of a custom page).
 */
export interface PageLink {
	label: string;
	href: string;
	icon?: string;
	external: boolean;
}
export interface PageHeaderProps {
	title: string;
	description?: string;
	/** Links drawn as the Figma "Actions": Secondary Small buttons, a trailing `export-square` icon on links that open a new tab. */
	links?: PageLink[];
	actions?: React$1.ReactNode;
	/** The h1 receives focus after a page change, so screen readers hear where they are. */
	headingRef?: React$1.Ref<HTMLHeadingElement>;
}
declare function PageHeader({ title, description, links, actions, headingRef, }: PageHeaderProps): React$1.ReactElement;
export interface SectionCardProps {
	title: string;
	description?: string;
	/** `danger`: red border, tinted footer — destructive actions only, always last on the page. */
	tone?: "default" | "danger";
	/** Only rendered when the page saves per section (or for a Danger card). */
	footer?: React$1.ReactNode;
	footerText?: string;
	/** `error`: the footer text is an error (`status/error/text`), e.g. a failed per-section save. */
	footerStatus?: "default" | "error";
	/** The footer text is a live status (a per-section save): announced politely when it changes. */
	footerLive?: boolean;
	children?: React$1.ReactNode;
}
declare function SectionCard({ title, description, tone, footer, footerText, footerStatus, footerLive, children }: SectionCardProps): React$1.ReactElement;
type SettingRowWidth = "default" | "wide" | "cards" | "range" | "full";
export interface SettingRowProps {
	title: string;
	description?: string;
	/** Why the control is disabled: shown under the description and part of the control's accessible description. */
	disabledReason?: string;
	/** Short status label next to the title ("Pro", "Beta"). */
	badge?: React$1.ReactNode;
	/**
	 * `inline`: on/off controls at the end of the row. `stacked`: inputs under the description. `field`: an input at the end
	 * of the row (stacked width, error under it); at ≤782px it falls back to `stacked`.
	 */
	layout?: "inline" | "stacked" | "field";
	/** Bottom divider; off on the last row of a card. */
	divider?: boolean;
	error?: string;
	/** The control is a group (checkbox group, radio group): the title names the group instead of labelling one control. */
	group?: boolean;
	/**
	 * The control's width, as Figma draws it: `default` 400, `wide` 448 (Textarea, Media Picker), `cards` 576 (Choice
	 * Cards), `range` 480 (Date Range Picker), `full` the whole row (Group List, Code Editor). Like every stacked control
	 * it shrinks (`max-w-full`) on narrow containers.
	 */
	width?: SettingRowWidth;
	disabled?: boolean;
	children: React$1.ReactNode;
}
interface TabsItem {
	id: string;
	label: string;
	icon?: string;
	badge?: string;
	disabled?: boolean;
}
export interface TabsProps {
	tabs: TabsItem[];
	value: string;
	onValueChange: (id: string) => void;
	/** Names the tab list for screen readers (the page title). */
	"aria-label": string;
	/** The badges' numerals; default the screen's locale. */
	locale?: string;
	/** Renders the panel of the active tab. */
	children: (id: string) => React$1.ReactNode;
	className?: string;
}
declare function Tabs({ tabs, value, onValueChange, "aria-label": label, locale: localeProp, children, className, }: TabsProps): React$1.ReactElement;
type BadgeTone = "gray" | "blue" | "green" | "amber" | "red";
type BadgeSize = "sm" | "md";
export interface BadgeProps {
	/** Figma `Tone` (Gray = neutral). */
	tone?: BadgeTone;
	/** Figma `Style`. Named `appearance` because `style` is React's. Solid is for one high-emphasis label ("Pro"). */
	appearance?: "subtle" | "solid";
	/** Figma `Size`: Small 20px / Medium 24px. */
	size?: BadgeSize;
	/** Optional 12px leading icon. */
	icon?: string;
	/** 1–2 words, or a count. Never interactive. */
	children: React$1.ReactNode;
	className?: string;
}
declare function Badge({ tone, appearance, size, icon, children, className, }: BadgeProps): React$1.ReactElement;
type Aria = Pick<React$1.AriaAttributes, keyof React$1.AriaAttributes>;
interface NativeAttributes<E extends Element> extends Aria, Pick<React$1.HTMLAttributes<E>, "id" | "title" | "tabIndex" | "autoFocus" | "onFocus" | "onBlur" | "onKeyDown" | "onKeyUp"> {
	className?: string;
	style?: React$1.CSSProperties;
	ref?: React$1.Ref<E>;
}
interface TextAttributes<E extends HTMLInputElement | HTMLTextAreaElement> extends NativeAttributes<E> {
	value?: string;
	defaultValue?: string;
	/** The new text; one argument. */
	onValueChange?: (value: string) => void;
	placeholder?: string;
	name?: string;
	disabled?: boolean;
	readOnly?: boolean;
	required?: boolean;
	autoComplete?: string;
	spellCheck?: boolean;
	autoCapitalize?: string;
	dir?: "ltr" | "rtl" | "auto";
	onPaste?: React$1.ClipboardEventHandler<E>;
}
type ButtonVariant = "primary" | "secondary" | "tertiary" | "error";
type ButtonSize = "sm" | "md" | "lg";
interface ButtonAttributes extends NativeAttributes<HTMLButtonElement>, Pick<React$1.ButtonHTMLAttributes<HTMLButtonElement>, "type" | "name" | "value" | "form" | "onClick" | "onMouseDown" | "onPointerDown"> {
	disabled?: boolean;
	/** A disabled button that keeps its place in the Tab order (announced as dimmed), e.g. Pagination's arrows. */
	focusableWhenDisabled?: boolean;
}
export interface ButtonProps extends ButtonAttributes {
	/** Figma `Type`. */
	variant?: ButtonVariant;
	/** Figma `Size`: 36 / 44 / 52. */
	size?: ButtonSize;
	/** Figma `State=Loading`: keeps the label and width, shows a spinner, ignores clicks. */
	loading?: boolean;
	leadingIcon?: string;
	trailingIcon?: string;
	children?: React$1.ReactNode;
}
export interface ButtonLinkProps extends Omit<React$1.ComponentPropsWithoutRef<"a">, "children"> {
	variant?: ButtonVariant;
	size?: ButtonSize;
	leadingIcon?: string;
	trailingIcon?: string;
	children?: React$1.ReactNode;
}
declare function ButtonLink({ variant, size, leadingIcon, trailingIcon, className, children, ...props }: ButtonLinkProps): React$1.ReactElement;
declare function Button({ variant, size, loading, disabled, leadingIcon, trailingIcon, className, children, ...props }: ButtonProps): React$1.ReactElement;
interface OptionDef {
	value: string;
	label: string;
	description?: string;
	disabled?: boolean;
}
interface CheckedAttributes extends NativeAttributes<HTMLElement> {
	checked?: boolean;
	defaultChecked?: boolean;
	/** The new state; one argument. */
	onCheckedChange?: (checked: boolean) => void;
	disabled?: boolean;
	readOnly?: boolean;
	required?: boolean;
	/** The name of the hidden input, for a native form. */
	name?: string;
}
export interface CheckboxProps extends CheckedAttributes {
	/** Names the option. Omit inside a Setting Row (its title is the name) or a group (each option has one). */
	label?: string;
	description?: string;
	/** A display state: a parent whose children are partly checked. */
	indeterminate?: boolean;
}
declare function Checkbox({ label, description, disabled, className, ...props }: CheckboxProps): React$1.ReactElement;
type ChoiceCardContent = "image_text" | "image" | "text";
interface ChoiceCardOption {
	value: string;
	/** Names the card, also when only the image is shown. */
	label: string;
	description?: string;
	/** URL of the preview picture (`image_text` and `image` cards). */
	image?: string;
	disabled?: boolean;
}
export interface ChoiceCardsProps {
	options: ChoiceCardOption[];
	content: ChoiceCardContent;
	columns?: 2 | 3 | 4;
	/** The selected option's `value`; `''` = nothing selected. */
	value: string;
	onValueChange: (value: string) => void;
	disabled?: boolean;
	name?: string;
	className?: string;
	/** Focus left the group (bubbled `blur`; the caller decides whether it moved between cards). */
	onBlur?: (event: React$1.FocusEvent<HTMLDivElement>) => void;
	"aria-labelledby"?: string;
	"aria-describedby"?: string;
}
declare function ChoiceCards({ options, content, columns, value, onValueChange, disabled, name, className, ...aria }: ChoiceCardsProps): React$1.ReactElement;
export interface CodeEditorProps {
	/** The code. */
	value: string;
	onValueChange: (value: string) => void;
	/** Colours the syntax and names it in the toolbar; `text` is plain. */
	language?: CodeLanguage;
	/** Lines shown before the code scrolls (Figma: 7). */
	rows?: number;
	/** Figma `Toolbar`: the language and the copy button. */
	toolbar?: boolean;
	/** Figma `Line numbers`. */
	lineNumbers?: boolean;
	/** Lines with an error (from 1): their number and their values turn red (Figma `State=Error`). */
	invalidLines?: readonly number[];
	disabled?: boolean;
	/** Focus left the editor (the caller validates). */
	onBlur?: () => void;
	name?: string;
	id?: string;
	"aria-label"?: string;
	className?: string;
}
declare function CodeEditor({ value, onValueChange, language, rows, toolbar, lineNumbers, invalidLines, disabled, onBlur, name, id, className, ...aria }: CodeEditorProps): React$1.ReactElement;
type ControlSize = ButtonSize;
export interface ColorPickerProps {
	/** `#rrggbb` (lower case), or '' for no colour. */
	value: string;
	onValueChange: (value: string) => void;
	/** Hex list in the panel; `false` hides the section. */
	presets?: readonly string[] | false;
	size?: ControlSize;
	/** Shown beside the dashed swatch while there is no colour. */
	placeholder?: string;
	disabled?: boolean;
	name?: string;
	id?: string;
	/** The page's locale (default: the screen's): the panel speaks its values in its numerals. */
	locale?: string;
	/** The picker closed, or focus left the closed field (the caller validates). */
	onBlur?: () => void;
	"aria-label"?: string;
	className?: string;
}
declare function ColorPicker({ value, onValueChange, presets, size, placeholder, disabled, name, id, locale: localeProp, onBlur, className, ...aria }: ColorPickerProps): React$1.ReactElement;
type CalendarKind = "jalali" | "gregorian";
type MomentKind = "date" | "time" | "datetime";
interface PickerBase {
	onValueChange: (value: string) => void;
	/** Minutes between the offered minutes (time, datetime). */
	step?: number;
	size?: ControlSize;
	placeholder?: string;
	disabled?: boolean;
	name?: string;
	id?: string;
	/** The page's locale (default: the screen's): its numerals, and Persian month names in Persian. */
	locale?: string;
	/** The popup closed, or focus left the closed field (the caller validates). */
	onBlur?: () => void;
	"aria-label"?: string;
	"aria-labelledby"?: string;
	className?: string;
}
export interface DatePickerProps extends PickerBase {
	/** `date`: `Y-m-d`. `datetime`: `Y-m-d H:i:s` in UTC, shown in the site's time. '' = nothing. */
	kind?: "date" | "datetime";
	value: string;
	/** The calendar the field writes in; `auto` = the site's, with the switch in the panel. */
	calendar?: CalendarKind | "auto";
	/** The earliest / latest value: stored format, or `today` (date) / `now` (datetime). */
	min?: string;
	max?: string;
}
export interface TimePickerProps extends PickerBase {
	/** `H:i` (24-hour), or ''. Text that could not be read as a time is kept, so the `time` rule can report it. */
	value: string;
}
type RangeEnd = "start" | "end";
export interface DateRangePickerProps {
	/** `date` (`Y-m-d`), `time` (`H:i`) or `datetime` (`Y-m-d H:i:s` in UTC) at both ends. */
	kind?: MomentKind;
	/** Both ends in the stored format; nothing = both ''. */
	value: DateRangeValue;
	onValueChange: (value: DateRangeValue) => void;
	/** The calendar both ends write in (date, datetime); `auto` = the site's, with the switch in the panel. */
	calendar?: CalendarKind | "auto";
	/** The earliest / latest value of either end: stored format, or `today` (date) / `now` (datetime). */
	min?: string;
	max?: string;
	/** Minutes between the offered minutes (time, datetime). */
	step?: number;
	size?: ControlSize;
	/** Both ends' placeholder, unless an end has its own. */
	placeholder?: string;
	startPlaceholder?: string;
	endPlaceholder?: string;
	disabled?: boolean;
	/** Figma "Error message", under the inputs. */
	error?: string;
	/** The end the error is about, drawn in red (Figma: the end). */
	invalid?: RangeEnd;
	/** The page's locale (default: the screen's): its numerals, and Persian month names in Persian. */
	locale?: string;
	/** Focus left the range (both inputs and their popups): the caller validates. */
	onBlur?: () => void;
	/** Names the range on its own (a filter in a toolbar); in a Setting Row with `group` the row's title names it. */
	"aria-label"?: string;
	/** Ids that name the range, instead of the Setting Row's title. */
	"aria-labelledby"?: string;
	/** Ids that describe the range, instead of the Setting Row's description (the Duration and the error are added). */
	"aria-describedby"?: string;
	className?: string;
}
declare function DateRangePicker({ kind, value, onValueChange, calendar, min, max, step, size, placeholder, startPlaceholder, endPlaceholder, disabled, error, invalid, locale: localeProp, onBlur, "aria-label": ariaLabel, "aria-labelledby": ariaLabelledBy, "aria-describedby": ariaDescribedBy, className, }: DateRangePickerProps): React$1.ReactElement;
type EmptyStateSize = "lg" | "sm";
export interface EmptyStateProps {
	/** Figma `Size`: Large for a whole card, tab or page (480); Small inside tables, lists and narrow panels (360). */
	size?: EmptyStateSize;
	/** Iconsax name, drawn 24px (Large) or 20px (Small) in the icon box. */
	icon: string;
	/** Names what is missing ("No integrations yet"), never a vague "Nothing here". */
	title: string;
	/** One sentence: why it is empty, or what filling it gains. */
	description?: string;
	/** At most one, and it creates the first item. A Button or ButtonLink; it is drawn Primary Small. */
	primaryAction?: React$1.ReactElement<ButtonProps | ButtonLinkProps>;
	/** Usually a docs link — or "Clear search" when a filter found nothing. Drawn Secondary Small. */
	secondaryAction?: React$1.ReactElement<ButtonProps | ButtonLinkProps>;
	/** The title's heading level: 3 inside a Section Card (whose title is an h2), 2 on its own. */
	headingLevel?: 2 | 3 | 4;
	className?: string;
}
declare function EmptyState({ size, icon, title, description, primaryAction, secondaryAction, headingLevel, className }: EmptyStateProps): React$1.ReactElement;
type TooltipSide = "top" | "bottom" | "start" | "end";
export interface TooltipProps {
	/**
	 * The text: a few words, sentence case, no final period, no links or buttons (a plain string on purpose). On an Icon
	 * Button it is the button's accessible name too (design rule 10) — `IconButton` does that for you.
	 */
	label: string;
	/** Default Top; flips only to avoid clipping. */
	side?: TooltipSide;
	/** The element the tooltip names. It receives the hover/focus handlers, so it must be a single focusable element. */
	children: React$1.ReactElement<Record<string, unknown>>;
}
declare function Tooltip({ label, side, children }: TooltipProps): React$1.ReactElement;
export interface IconButtonProps extends Omit<ButtonAttributes, "aria-label"> {
	/** Iconsax name. */
	icon: string;
	/**
	 * REQUIRED (design rule 10): the accessible name AND the Tooltip text — the same string, so they can never differ.
	 * A few words, sentence case, no final period ("Edit", "Remove domain").
	 */
	label: string;
	/** Figma `Type`. Default Tertiary: the quiet button for toolbars, rows and close controls. */
	variant?: ButtonVariant;
	/** Figma `Size`: a 32 / 40 / 48 square; the icon is 16 (20 at Large). */
	size?: ButtonSize;
	/** Figma `State=Loading`: the spinner replaces the icon; clicks are ignored. */
	loading?: boolean;
	/** Default Top; flips only to avoid clipping. Start and End follow the reading direction. */
	tooltipSide?: TooltipSide;
}
declare function IconButton({ icon, label, variant, size, loading, tooltipSide, disabled, className, ...props }: IconButtonProps): React$1.ReactElement;
export interface IconPickerProps {
	/** An Iconsax icon name in kebab case (`setting-2`), or '' for none. */
	value: string;
	onValueChange: (value: string) => void;
	/** The names the modal offers; `null` / omitted = every Iconsax icon. */
	icons?: readonly string[] | null;
	size?: ControlSize;
	/** Shown beside the dashed tile while there is no icon. */
	placeholder?: string;
	disabled?: boolean;
	name?: string;
	id?: string;
	/** The page's locale (default: the screen's): the modal speaks its counts in its numerals. */
	locale?: string;
	/** The modal closed, or focus left the closed field (the caller validates). */
	onBlur?: () => void;
	"aria-label"?: string;
	"aria-labelledby"?: string;
	"aria-describedby"?: string;
	className?: string;
}
declare function IconPicker({ value, onValueChange, icons, size, placeholder, disabled, name, id, locale: localeProp, onBlur, className, ...aria }: IconPickerProps): React$1.ReactElement;
/** One Figma `Status` label of a Group Item: what holds for the item ("Scheduled", "Ended") without opening it. */
export interface GroupItemStatus {
	/** One or two words. */
	label: string;
	/** Figma Badge `Tone`; default gray. */
	tone?: BadgeTone;
	/** Iconsax name of the Badge's 12px icon. */
	icon?: string;
}
export interface GroupItemProps {
	/** The item's name in its header ("Pricing", or "Item 2" when it has none). */
	title: string;
	/** One line under the title (a link): Mono/12 when `mono`. */
	summary?: string;
	mono?: boolean;
	/** Preview tile: an Iconsax name, '' for an empty (dashed) tile, `undefined` for no tile. */
	preview?: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Figma `Status`: Small Subtle Badges after the title, before the error count. Usually one. */
	status?: readonly GroupItemStatus[];
	/**
	 * Figma `State=Inactive`: the item is kept but not in effect (the site does not show it), so its preview, title and
	 * summary fade. It stays editable. Fading says nothing to a screen reader: give it a `status` label too ("Inactive").
	 */
	inactive?: boolean;
	/** Invalid sub-fields inside: red border and a count in the header (shown while collapsed too). */
	errorCount?: number;
	/** Duplicate / Remove Icon Buttons, before the chevron. */
	actions?: React$1.ReactNode;
	/** The sub-fields. Rendered only while open. */
	children: React$1.ReactNode;
	className?: string;
}
export interface GroupListProps<T> {
	/** The items, in order: any values (a page's records, a field's rows). */
	items: readonly T[];
	/** Every change of the list: a move, an add, a duplicate, a removal and its Undo, or an item's own edit (`update`). */
	onChange: (items: T[]) => void;
	/** An item's title in its header and in the names of its buttons; empty = "Item 2". */
	title: (item: T, index: number) => string;
	/** One line under the title; `mono` sets it in Mono/12 (a link, a slug). */
	summary?: (item: T, index: number) => string | {
		text: string;
		mono?: boolean;
	} | null | undefined;
	/** The header's tile: an Iconsax name, `''` for an empty tile; `undefined` for none. */
	preview?: (item: T, index: number) => string | undefined;
	/** Status labels after the title (Group Item `Status`). */
	status?: (item: T, index: number) => readonly GroupItemStatus[] | undefined;
	/** The item is kept but not in effect (Group Item `State=Inactive`). */
	inactive?: (item: T, index: number) => boolean;
	/** How many errors the item holds: a red border and a count, also while it is closed. */
	errorCount?: (item: T, index: number) => number;
	/** The open item's body: its fields. `update` replaces this item. */
	children: (item: T, index: number, update: (item: T) => void) => React$1.ReactNode;
	/** A drag handle per item: pointer, or the keyboard (Space picks up, the arrows move, Space drops, Escape cancels). */
	sortable?: boolean;
	/** Add (at the end), Duplicate (below) and Remove (with Undo in a toast). Needs `create`. */
	addable?: boolean;
	/** A new item for Add. */
	create?: () => T;
	/** A copy for Duplicate; default a deep copy of the JSON value. */
	copy?: (item: T) => T;
	/** Fewest and most items: Remove, and Add and Duplicate, are disabled there; with `max` a count is shown next to Add. */
	min?: number | null;
	max?: number | null;
	addLabel?: string;
	disabled?: boolean;
	/** Grows when a save is refused: the first item with errors opens. */
	reveal?: number;
	/** The locale of the count's numerals; default the screen's. */
	locale?: string;
	/** On its own (not in a Setting Row), name the list. */
	"aria-label"?: string;
}
declare function GroupList<T>({ items, onChange, title: titleOf, summary, preview, status, inactive, errorCount, children, sortable, addable, create, copy, min, max, addLabel, disabled, reveal, locale: localeProp, "aria-label": ariaLabel, }: GroupListProps<T>): React$1.ReactElement;
export interface InputProps extends TextAttributes<HTMLInputElement> {
	size?: ControlSize;
	/** `text` (default), `email`, `url`, `password`, `search`, `tel`… */
	type?: React$1.HTMLInputTypeAttribute;
	inputMode?: "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search";
	maxLength?: number;
	minLength?: number;
	pattern?: string;
	/** Iconsax name shown before the value (hints the content: search, URL). */
	prefixIcon?: string;
	/** Trailing content, usually an icon-only action (clear). */
	suffix?: React$1.ReactNode;
	/**
	 * URLs, emails, keys and code: the text stays LTR even inside an RTL layout, and sits at the inline end of the
	 * field there (right-aligned, as the pack's Input usage frame draws its FA email) — left-aligned in an LTR layout.
	 */
	ltr?: boolean;
	/** Read Persian and Arabic-Indic digits (and the Persian separators ٫ ٬) as ASCII while typing or pasting (URL, email, number). The caret stays where it was. */
	digits?: boolean;
}
declare function Input({ size, prefixIcon, suffix, ltr, digits, className, onValueChange, ref, ...props }: InputProps): React$1.ReactElement;
interface ItemCardDetail {
	icon: string;
	label: React$1.ReactNode;
}
export interface ItemCardProps {
	/** The record's name, on one line (it truncates). It is the link or button that opens the record (`href` / `onOpen`). */
	title: string;
	/** A short count or fact at the end of the title row ("3 slides"). */
	meta?: React$1.ReactNode;
	/** At most two lines (the rest is cut with an ellipsis). */
	description?: React$1.ReactNode;
	/**
	 * The plugin's own picture of the record (a cover image, an avatar, a preview), centred in a 136px area on
	 * `background/subtle`. It is not interactive: a click on it opens the record. Omit it and there is no media area.
	 */
	media?: React$1.ReactNode;
	/** A Badge at the top start (Published, Draft, Scheduled): over the media, or above the title without media. */
	status?: React$1.ReactNode;
	/** One more Badge at the top end, for a flag such as Pinned. */
	flag?: React$1.ReactNode;
	/** Non-removable Small Tags under the title (already translated). */
	tags?: string[];
	/** Footer meta, at most 2 (more are not shown). */
	details?: ItemCardDetail[];
	/** Tertiary Small IconButtons at the end of the footer (edit, duplicate, delete). They stay separate from opening the card. */
	actions?: React$1.ReactNode;
	/** Opens the record. The title becomes a button stretched over the card, so the whole card is clickable. */
	onOpen?: () => void;
	/** Opens the record by link. The title becomes a link stretched over the card; `onOpen` (if any) also runs on click. */
	href?: string;
	className?: string;
}
declare function ItemCard({ title, meta, description, media, status, flag, tags, details, actions, onOpen, href, className }: ItemCardProps): React$1.ReactElement;
export interface AddItemCardProps {
	/** What it creates ("Add item", "New story"). */
	title: string;
	/** One short sentence under the title. */
	description?: string;
	/** Opens the editor for a new item (a button). */
	onClick?: () => void;
	/** Or a link to that editor. */
	href?: string;
	className?: string;
}
declare function AddItemCard({ title, description, onClick, href, className }: AddItemCardProps): React$1.ReactElement;
type MediaKind = "image" | "file";
export interface MediaPickerProps {
	/** `image`: Upload Image (a thumbnail). `file`: Select File (a file tile). */
	kind: MediaKind;
	/** The field label: the media modal's title and part of the buttons' accessible names. */
	label: string;
	/** The attachment ID (0 = nothing chosen). */
	value: number;
	/**
	 * What to draw for `value`; null while nothing is chosen. Left out, the picker asks `wp.media` about the attachment
	 * itself (a custom page or field that keeps only the ID).
	 */
	media?: MediaItem | null;
	/** MIME types the field accepts; null = every image (`image`), or every type (`file`). */
	mimes?: readonly string[] | null;
	/** Largest file in bytes; null / omitted = no limit. */
	maxSize?: number | null;
	/**
	 * A usable attachment was chosen in the media modal (its ID and what it is), or "Remove" was pressed (0 and null).
	 * Nothing is deleted from the media library.
	 */
	onValueChange: (value: number, item: MediaItem | null) => void;
	/** The chosen attachment is the wrong type or too large: the caller shows the message; the value stays. */
	onError: (message: string) => void;
	disabled?: boolean;
	/** The page's locale (default: the screen's): sizes and dimensions are written in its numerals. */
	locale?: string;
	/** Focus left the field (the caller validates), or the media modal closed. */
	onBlur?: () => void;
	className?: string;
}
declare function MediaPicker({ kind, label, value, media, mimes, maxSize, onValueChange, onError, disabled, locale: localeProp, onBlur, className }: MediaPickerProps): React$1.ReactElement;
export interface ModalProps {
	open: boolean;
	/** Called with `false` when the modal asks to close: Esc, the close button, a click on the backdrop (Default only), or Cancel. Esc is Cancel: it never confirms. */
	onOpenChange: (open: boolean) => void;
	/**
	 * Figma `Type`, named `tone` as on Section Card. Default: a confirmation that discards work. Danger: an irreversible
	 * action, with an Error button.
	 */
	tone?: "default" | "danger";
	/** A question that names the action ("Discard unsaved changes?", "Reset all settings?"). */
	title: string;
	description?: string;
	/** Secondary Small, at the start of the footer. */
	cancelLabel: string;
	/** At the end of the footer (Primary; Error in a Danger modal); repeats the verb of the title — never "OK". */
	confirmLabel: string;
	/**
	 * Runs on Confirm. Return a promise for an action that takes time: the modal then shows it running (Confirm loading,
	 * Cancel and the close button disabled) and cannot be closed until it settles. The caller closes the modal when the
	 * action is done; if the action failed and the modal should stay, just do not close it.
	 */
	onConfirm: () => void | Promise<void>;
	/**
	 * Danger only, for high-impact actions: the words the user must type before Confirm is enabled (case-sensitive,
	 * surrounding spaces ignored). It is checked again on the server.
	 */
	confirmKeyword?: string;
	/** Where focus goes once the modal has closed after Confirm (e.g. the heading of the page it led to). Default: stays put. */
	focusAfterConfirm?: () => HTMLElement | null;
	/**
	 * Figma `Content`: a few controls between the text and the buttons, such as an option that changes what the action
	 * does (a Checkbox "Also delete its media files"). Keep it short: a dialog is not a form.
	 */
	children?: React$1.ReactNode;
}
declare function Modal({ open, onOpenChange, tone, title, description, cancelLabel, confirmLabel, onConfirm, confirmKeyword, focusAfterConfirm, children }: ModalProps): React$1.ReactElement;
type TagSize = "sm" | "md";
export interface TagProps {
	/** Text shown in the tag (already translated). */
	label: string;
	/** Figma `Size`: Small 20px / Medium 24px. */
	size?: TagSize;
	/** Adds the 12px remove button. Absent = a non-removable tag (the overflow "+n"). */
	onRemove?: () => void;
	/** Screen-reader text when `label` is only a glyph ("+2" → "2 more selected"). */
	srLabel?: string;
	disabled?: boolean;
	className?: string;
}
declare function Tag({ label, size, onRemove, srLabel, disabled, className }: TagProps): React$1.ReactElement;
interface MultiSelectOption {
	value: string;
	label: string;
	disabled?: boolean;
	/** Iconsax name shown after the checkbox (Figma Menu Item "Leading icon"). */
	icon?: string;
}
export interface MultiSelectProps {
	options: MultiSelectOption[];
	/** Selected option values. */
	value: string[];
	onValueChange: (value: string[]) => void;
	placeholder?: string;
	size?: ControlSize;
	/** The search row inside the popup (Figma Select Menu `Search`). Off: the list is not filterable. */
	searchable?: boolean;
	/** The 16px Clear button in the field (Figma `Clear button`, default off). */
	clearable?: boolean;
	/** The popup footer with "n selected" and Clear (Figma Select Menu `Footer`). */
	menuFooter?: boolean;
	/** Tags shown before the non-removable "+n" chip. Figma shows three. */
	maxVisibleTags?: number;
	disabled?: boolean;
	name?: string;
	id?: string;
	/** Names the popup ("Show on"). */
	"aria-label"?: string;
	className?: string;
	/** The user is done with the field: the popup closed, or focus left it. */
	onBlur?: () => void;
}
declare function MultiSelect({ options, value, onValueChange, placeholder, size, searchable, clearable, menuFooter, maxVisibleTags, disabled, name, id, className, onBlur, "aria-label": ariaLabel, }: MultiSelectProps): React$1.ReactElement;
export interface NoticeProps {
	/** Figma `Tone`: gray (default), blue, green, amber, red. */
	tone?: NoticeTone;
	/** Figma `Show title`: short, sentence case. Optional. */
	title?: string;
	/** The message: what happened and what to do next. */
	children: React$1.ReactNode;
	/** Figma `Show action`: one Secondary Small Button (or link button) at the end, centred on the notice's height. */
	action?: React$1.ReactNode;
	/**
	 * Figma `Dismissible`: a close control at the very end. Errors and warnings stay until resolved (design rule 6), so
	 * only offer it on gray, blue and green notices. The caller removes the notice — and moves focus somewhere sensible.
	 */
	onDismiss?: () => void;
	/**
	 * The notice appeared AFTER the page loaded (a failed save, a conflict): announce it. Gray, blue and green use
	 * `role="status"` (polite), amber and red `role="alert"` (assertive). Notices that are on the page from the start
	 * are not live: a screen reader would otherwise read all of them out at load.
	 */
	live?: boolean;
	className?: string;
}
declare function Notice({ tone, title, children, action, onDismiss, live, className }: NoticeProps): React$1.ReactElement;
export interface NumberInputProps extends Omit<InputProps, "value" | "defaultValue" | "onValueChange" | "type" | "inputMode" | "ltr" | "digits"> {
	/** The value the form holds: a number, `''` (nothing), or text that is not (yet) a number. */
	value: number | string;
	onValueChange: (next: number | string) => void;
}
declare function NumberInput({ value, onValueChange, ...input }: NumberInputProps): React$1.ReactElement;
export interface PaginationProps {
	/** The current page, 1-based. */
	page: number;
	/** How many pages there are. With one page (or none) nothing is rendered. */
	pageCount: number;
	/** Called with the page to show (`page − 1` or `page + 1`). */
	onPageChange: (page: number) => void;
	/** At the start: what is shown ("Showing 1–8 of 24 items"), in the page's numerals. */
	summary?: React$1.ReactNode;
	/** The `<nav>`'s accessible name. Default "Pagination"; name it when a page has more than one ("Stories pages"). */
	"aria-label"?: string;
	className?: string;
}
declare function Pagination({ page, pageCount, onPageChange, summary, "aria-label": label, className }: PaginationProps): React$1.ReactElement | null;
export interface RadioGroupProps {
	/** 2–5 visible options. More than that is a Select. */
	options: OptionDef[];
	value: string;
	onValueChange: (value: string) => void;
	disabled?: boolean;
	name?: string;
	className?: string;
	/** Focus left the group (bubbled `blur`; the caller decides whether it moved between options). */
	onBlur?: (event: React$1.FocusEvent<HTMLDivElement>) => void;
	"aria-labelledby"?: string;
	"aria-describedby"?: string;
}
declare function RadioGroup({ options, value, onValueChange, disabled, name, className, ...aria }: RadioGroupProps): React$1.ReactElement;
interface SegmentOption {
	value: string;
	label: string;
	disabled?: boolean;
}
export interface SegmentedControlProps {
	/** 2–5 short options. Longer lists are a Select. */
	options: SegmentOption[];
	value: string;
	onValueChange: (value: string) => void;
	disabled?: boolean;
	name?: string;
	/** The track takes the whole width and the segments share it equally (the Calendar Panel's calendar switch). */
	fill?: boolean;
	className?: string;
	/** Focus left the control (bubbled `blur`; the caller decides whether it moved between segments). */
	onBlur?: (event: React$1.FocusEvent<HTMLDivElement>) => void;
	"aria-label"?: string;
	"aria-labelledby"?: string;
	"aria-describedby"?: string;
}
declare function SegmentedControl({ options, value, onValueChange, disabled, name, fill, className, ...aria }: SegmentedControlProps): React$1.ReactElement;
interface SelectOption {
	value: string;
	label: string;
	disabled?: boolean;
	icon?: string;
}
export interface SelectProps {
	options: SelectOption[];
	value: string;
	onValueChange: (value: string) => void;
	placeholder?: string;
	size?: ControlSize;
	/** Iconsax name shown before the value (e.g. `global` for a language select). */
	prefixIcon?: string;
	disabled?: boolean;
	name?: string;
	id?: string;
	/**
	 * The person has left the control: on a pick or another close of the popup (after `onValueChange`), and when focus
	 * leaves the closed control. Not when the popup opens, though it takes the focus.
	 */
	onBlur?: () => void;
	"aria-label"?: string;
	"aria-labelledby"?: string;
	"aria-describedby"?: string;
	className?: string;
}
declare function Select({ options, value, onValueChange, placeholder, size, prefixIcon, disabled, name, id, onBlur, className, ...aria }: SelectProps): React$1.ReactElement;
type StatTrend = "up" | "down" | "neutral";
type StatTone = "positive" | "negative" | "neutral";
interface StatDelta {
	/** The change, already formatted in the page's numerals ("12%", "۱۲٪"). */
	value: React$1.ReactNode;
	/** The direction: an arrow up or down; none for neutral. */
	trend: StatTrend;
	/**
	 * Whether the change is good news. Default: up → positive (green), down → negative (red), neutral → gray. Set it when
	 * up is bad (a bounce rate that went up is `{ trend: 'up', tone: 'negative' }`).
	 */
	tone?: StatTone;
}
export interface StatCardProps {
	/** What is counted ("Views"), one or two words. */
	label: string;
	/** The number, already formatted in the page's numerals ("4,820", "۴٬۸۲۰"). */
	value: React$1.ReactNode;
	/** Iconsax name, drawn 16px in the 28px box at the end of the header. */
	icon?: string;
	/** The change against the previous period, as a Small subtle Badge. */
	delta?: StatDelta;
	/** What the change is measured against ("vs previous 30 days"). */
	comparison?: React$1.ReactNode;
	className?: string;
}
declare function StatCard({ label, value, icon, delta, comparison, className }: StatCardProps): React$1.ReactElement;
export interface TextareaProps extends TextAttributes<HTMLTextAreaElement> {
	/** Rows the default height is authored for (Figma: 4 → 120px). The user can still resize. */
	rows?: number;
	/** Figma "Resize handle": vertical only, or none. */
	resize?: "vertical" | "none";
}
declare function Textarea({ rows, resize, className, style, ...props }: TextareaProps): React$1.ReactElement;
type ToggleSize = "sm" | "md";
export interface ToggleProps extends CheckedAttributes {
	/** Figma `Size`: Small 28×16 (dense lists), Medium 36×20 (standalone). */
	size?: ToggleSize;
	/** Label the FEATURE, not the state ("Enable caching"). Omit when a Setting Row supplies the name. */
	label?: string;
	description?: string;
}
declare function Toggle({ size, label, description, className, onCheckedChange, ...props }: ToggleProps): React$1.ReactElement;
type IconSize = 12 | 14 | 16 | 18 | 20 | 24;
export interface IconProps {
	/** Any Iconsax icon by kebab-case name: `setting-2`, `arrow-down`, `tick-circle`… */
	name: string;
	/** 16 default · 12 Badge/Tag · 14 Icon Picker preview (Small) · 18 medium Button/Tab · 20 Nav Item and large Button · 24 Empty State and large Icon Button. */
	size?: IconSize;
	/** Meaningful icons only. Decorative icons (the default) are `aria-hidden`. */
	label?: string;
	className?: string;
}
declare function Icon({ name, size, label, className }: IconProps): React$1.ReactElement | null;
interface IconSvgOptions {
	/** Width and height in px; none by default, so CSS sizes it. */
	size?: number;
	/** A `class` attribute. */
	className?: string;
	/** An accessible name: `role="img"` and `aria-label` instead of `aria-hidden`. */
	label?: string;
}
declare function iconSvg(name: string, options?: IconSvgOptions): Promise<string>;
declare const sdk: {
	readonly version: 1;
	/** The version of the Fyldo that serves the screen (`1.2.0`). Within 1.x, feature-detect a member with `'name' in sdk`. */
	readonly fyldoVersion: string;
	/** Fyldo's own React 19: never bundle a second one (hooks break). */
	readonly React: typeof React$1;
	readonly ui: {
		readonly AddItemCard: typeof AddItemCard;
		readonly Badge: typeof Badge;
		readonly Button: typeof Button;
		readonly ButtonLink: typeof ButtonLink;
		readonly Checkbox: typeof Checkbox;
		readonly ChoiceCards: typeof ChoiceCards;
		readonly CodeEditor: typeof CodeEditor;
		readonly ColorPicker: typeof ColorPicker;
		readonly DatePicker: React$1.ComponentType<DatePickerProps>;
		readonly DateRangePicker: typeof DateRangePicker;
		readonly EmptyState: typeof EmptyState;
		readonly GroupItem: React$1.ComponentType<GroupItemProps>;
		readonly GroupList: typeof GroupList;
		readonly Icon: typeof Icon;
		readonly IconButton: typeof IconButton;
		readonly IconPicker: typeof IconPicker;
		readonly Input: typeof Input;
		readonly ItemCard: typeof ItemCard;
		readonly MediaPicker: typeof MediaPicker;
		readonly Modal: typeof Modal;
		readonly MultiSelect: typeof MultiSelect;
		readonly Notice: typeof Notice;
		readonly NumberInput: typeof NumberInput;
		readonly PageHeader: typeof PageHeader;
		readonly Pagination: typeof Pagination;
		readonly RadioGroup: typeof RadioGroup;
		readonly SectionCard: typeof SectionCard;
		readonly SegmentedControl: typeof SegmentedControl;
		readonly Select: typeof Select;
		readonly SettingRow: React$1.ComponentType<SettingRowProps>;
		readonly StatCard: typeof StatCard;
		readonly Tabs: typeof Tabs;
		readonly Tag: typeof Tag;
		readonly Textarea: typeof Textarea;
		readonly TimePicker: React$1.ComponentType<TimePickerProps>;
		readonly Toggle: typeof Toggle;
		readonly Tooltip: typeof Tooltip;
	};
	/** Fields of a form registered in PHP, stored by the plugin: `<Form form="…" record="new" | "<key>" onSaved={…} />`. */
	readonly Form: typeof Form;
	/** The same form, drawn by the page: `const form = useForm({ form, record, onSaved })`, then `h(form.Frame, null, …)`. */
	readonly useForm: typeof useRecordForm;
	/**
	 * One Iconsax icon as `<svg>` markup, for drawing outside React (a shadow root, an iframe, a site preview): resolves to
	 * the same markup as PHP's `Fyldo::icon()`, or '' for a name that is not an icon. Loads only that icon, once.
	 */
	readonly iconSvg: typeof iconSvg;
};
export type FyldoSdk = typeof sdk;
/** What the control gets, in React (`Component` props) and in plain DOM (`mount` / `update`). */
export interface CustomFieldProps {
	value: JsonValue;
	/** Any JSON value; it is what the Save Bar saves. */
	onChange: (value: JsonValue) => void;
	/** Call when focus leaves the control: the field is validated then, like every other field. */
	onBlur: () => void;
	disabled: boolean;
	/** The field shows an error under the control. */
	invalid: boolean;
	/** Id of the row's title: put it in `aria-labelledby` of the control (or of a `role="group"` around several). */
	labelledBy: string;
	/** Ids of the row's description and disabled reason, for `aria-describedby`; undefined when there is none. */
	describedBy?: string;
	/** The field's `props` from PHP. */
	props: Record<string, JsonValue>;
	field: {
		id: string;
		label: string;
		description: string;
	};
	/** The page's locale, BCP-47 (`fa-IR`…). The direction is the one of the page: `element.closest('[dir]')`. */
	locale: string;
	/**
	 * The current values of the fields named in PHP's `watch`, keyed by id, with the person's edits as they happen (a live
	 * preview). Inside a group they are the other sub-fields of the field's own item. Read-only: `{}` when the field
	 * watches nothing. The object is new only when one of them changes.
	 */
	values: Readonly<Record<string, JsonValue>>;
}
export interface CustomFieldMountHandle {
	/** New props (value, disabled, invalid…) after a change. */
	update?: (props: CustomFieldProps) => void;
	/** The field leaves the screen (another page or tab). */
	destroy?: () => void;
}
/** The second argument of a definition's `validate`: what the check may depend on besides the value. */
export interface CustomFieldValidateContext {
	/** The field's `props` from PHP. */
	props: Record<string, JsonValue>;
	/** The current values of the fields named in `watch` (in a group: the other sub-fields of the item), as `values` of the control. */
	values: Readonly<Record<string, JsonValue>>;
	field: {
		id: string;
		label: string;
		description: string;
	};
	/** The page's locale, BCP-47 (`fa-IR`…). */
	locale: string;
}
export interface CustomFieldDefinition {
	/** A React component, rendered with Fyldo's own React (hooks work; never bundle a second React). */
	Component?: React$1.ComponentType<CustomFieldProps>;
	/** Plain DOM, or any framework: draw into `element`. Used when there is no `Component`. */
	mount?: (element: HTMLElement, props: CustomFieldProps) => CustomFieldMountHandle | void;
	/** Instant feedback on blur and save; the server (`validate_cb`) still decides. A message, or null when valid. */
	validate?: (value: JsonValue, context: CustomFieldValidateContext) => string | null | undefined;
}
/** A module's default export: the definition, or a function of the SDK that returns it. */
export type CustomFieldExport = CustomFieldDefinition | ((sdk: FyldoSdk) => CustomFieldDefinition);
type QueryValue = string | number | boolean | null | undefined | Array<string | number>;
export interface RequestOptions {
	/** Default GET. PUT, PATCH and DELETE are sent as POST + `X-HTTP-Method-Override`. */
	method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	/** Sent as the JSON body. */
	data?: unknown;
	query?: Record<string, QueryValue>;
	signal?: AbortSignal;
}
type RequestFn = <T = unknown>(path: string, options?: RequestOptions) => Promise<T>;
/** What the page gets, in React (`Component` props) and in plain DOM (`mount` / `update`). */
export interface CustomPageProps {
	/** `links`: the page's own links, ready for `ui.PageHeader`'s `links`. */
	page: {
		id: string;
		title: string;
		description: string;
		icon: string;
		links: PageLink[];
	};
	/** The URL segments after the page's id, decoded: `#/announcements/42/edit` → ['42', 'edit']; [] at the page itself. */
	path: string[];
	/** The page's `props` from PHP. */
	props: Record<string, JsonValue>;
	locale: string;
	dir: "ltr" | "rtl";
	/**
	 * Show another path of this page (`'42/edit'` or `['42', 'edit']`; '' or [] = the page itself). It adds a history
	 * entry (`replace`: it does not), and asks first when the page has unsaved changes.
	 */
	navigate: (path: string | string[], options?: {
		replace?: boolean;
	}) => void;
	/** The plugin's own REST routes, relative to the site's REST root, with the user's nonce. */
	request: RequestFn;
	/** Toasts in Fyldo's stack: one short sentence without a final period; an error may offer one action ("Retry"). */
	toast: {
		success: (message: string) => void;
		error: (message: string, options?: {
			action?: {
				label: string;
				onClick: () => void;
			};
		}) => void;
	};
	/** The page has unsaved changes (a `<Form>` reports its own): leaving it, or its path, asks first. */
	setDirty: (dirty: boolean) => void;
	/** Put it on the page's h1 (`ui.PageHeader`'s `headingRef`): focus goes there after a page or path change. */
	headingRef: (element: HTMLElement | null) => void;
}
export interface CustomPageMountHandle {
	/** New props (another path, a new `navigate`…). */
	update?: (props: CustomPageProps) => void;
	/** The page leaves the screen. */
	destroy?: () => void;
}
export interface CustomPageDefinition {
	/** A React component, rendered with Fyldo's own React (hooks work; never bundle a second React). */
	Component?: React$1.ComponentType<CustomPageProps>;
	/** Plain DOM, or any framework: draw into `element`. Used when there is no `Component`. */
	mount?: (element: HTMLElement, props: CustomPageProps) => CustomPageMountHandle | void;
}
/** A module's default export: the definition, or a function of the SDK that returns it. */
export type CustomPageExport = CustomPageDefinition | ((sdk: FyldoSdk) => CustomPageDefinition);

export {};
