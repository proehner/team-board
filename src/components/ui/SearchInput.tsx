import { forwardRef, type InputHTMLAttributes } from 'react'
import { Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'size'> {
  value: string
  onChange: (value: string) => void
  size?: 'sm' | 'md'
  /** Wrapper class (width etc.) */
  className?: string
}

/** Text input with search icon and clear button. Escape clears the value. */
const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, size = 'md', className = '', placeholder, ...rest }, ref) => {
    const { t } = useTranslation()
    const sm = size === 'sm'
    return (
      <div className={`relative ${className}`}>
        <Search className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${sm ? 'left-2.5 h-3.5 w-3.5' : 'left-3 h-4 w-4'}`} />
        <input
          ref={ref}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && value) { e.stopPropagation(); onChange('') }
          }}
          placeholder={placeholder ?? t('common.search')}
          className={`form-input [&::-webkit-search-cancel-button]:hidden ${sm ? 'form-sm pl-8 pr-7' : 'pl-9 pr-8'}`}
          {...rest}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label={t('common.clear')}
            className={`absolute top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 ${sm ? 'right-1.5' : 'right-2'}`}
          >
            <X className={sm ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
          </button>
        )}
      </div>
    )
  },
)
SearchInput.displayName = 'SearchInput'
export default SearchInput
