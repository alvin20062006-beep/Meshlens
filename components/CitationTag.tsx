type Props = {
  label?: string
  href?: string
}

export function CitationTag({ label = "source", href }: Props) {
  const tag = (
    <span className="ml-badge inline-flex items-center px-2 py-0.5 text-[11px]">
      [{label}]
    </span>
  )
  if (!href) return tag
  return (
    <a href={href} target="_blank" rel="noreferrer" className="hover:opacity-80">
      {tag}
    </a>
  )
}

