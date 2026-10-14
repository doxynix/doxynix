# Forms & Inputs

**`src/shared/ui/core/form.tsx` in this repo is the React Hook Form variant**, not the newer
`Field` / `FieldGroup` / `InputGroup` API. Use these exports:

| Export | Purpose |
|--------|---------|
| `Form` | `<form>` provider, wires `useFormContext` |
| `FormField` | `<Controller>` wrapper bound to a field name |
| `FormItem` | field wrapper; supplies id / error-id context |
| `FormLabel` | `<label>` linked to the control via `htmlFor` |
| `FormControl` | clones the child and injects `id`, `aria-describedby`, `aria-invalid` |
| `FormDescription` | helper text, referenced by `aria-describedby` |
| `FormMessage` | validation error, referenced by `aria-describedby` |

Validation itself is Zod via `@hookform/resolvers` (`zodResolver`) wired into `useForm` — see the
`zod` and `react-hook-form` skills.

## Contents

- The canonical field
- Description and error text
- Checkboxes, switches and selects
- Field arrays
- Grouping

---

## The canonical field

```tsx
const form = useForm<z.infer<typeof Schema>>({
  resolver: zodResolver(Schema),
});

<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
    <FormField
      control={form.control}
      name="email"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Email</FormLabel>
          <FormControl>
            <Input type="email" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
    <Button type="submit" disabled={form.formState.isSubmitting}>
      Submit
    </Button>
  </form>
</Form>
```

**`FormControl` is not optional.** It is what injects the generated ids and `aria-invalid`; a bare
`<Input {...field} />` inside `FormItem` leaves the label and error text unlinked.

Layout uses `flex flex-col gap-*` — never `space-y-*` (see [styling.md](./styling.md)).

## Description and error text

```tsx
<FormItem>
  <FormLabel>Password</FormLabel>
  <FormControl>
    <Input type="password" {...field} />
  </FormControl>
  <FormDescription>At least 12 characters.</FormDescription>
  <FormMessage />
</FormItem>
```

`FormDescription` and `FormMessage` both feed `aria-describedby` on the control. Render
`FormMessage` in every field — an empty message renders nothing, so it costs nothing when valid.

## Checkboxes, switches and selects

`Checkbox`, `Switch` and `Select` all go through `FormControl` the same way, so the a11y wiring is
identical:

```tsx
<FormField
  control={form.control}
  name="remember"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Remember me</FormLabel>
      <FormControl>
        <Switch checked={field.value} onCheckedChange={field.onChange} />
      </FormControl>
    </FormItem>
  )}
/>
```

Remember: `items` always sit inside their group — `SelectItem` inside `SelectGroup`,
`DropdownMenuItem` inside `DropdownMenuGroup` (see [composition.md](./composition.md)).

Two-digit verification codes use `InputOTP` (`input-otp.tsx`), also wrapped in `FormControl`.

## Field arrays

Use `useFieldArray` for repeatable rows — see the `react-hook-form` skill for the
`useFieldArray` / disabled-field-array details. The key prop comes from `field.id`, never the index.

## Grouping

Related fields are grouped with a plain `fieldset` + `legend` (`label.tsx` provides `Label`):

```tsx
<fieldset className="flex flex-col gap-4">
  <legend className="text-sm font-medium">Notifications</legend>
  ...
</fieldset>
```

There is no `FieldSet` / `FieldLegend` / `FieldGroup` component installed — do not import one.