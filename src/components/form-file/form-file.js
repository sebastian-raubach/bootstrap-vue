import Vue from '../../utils/vue'
import { from as arrayFrom, concat, flattenDeep, isArray } from '../../utils/array'
import { getComponentConfig } from '../../utils/config'
import { isFunction } from '../../utils/inspect'
import formCustomMixin from '../../mixins/form-custom'
import formMixin from '../../mixins/form'
import formStateMixin from '../../mixins/form-state'
import idMixin from '../../mixins/id'
import normalizeSlotMixin from '../../mixins/normalize-slot'

const NAME = 'BFormFile'

// @vue/component
export const BFormFile = /*#__PURE__*/ Vue.extend({
  name: NAME,
  mixins: [idMixin, formMixin, formStateMixin, formCustomMixin, normalizeSlotMixin],
  model: {
    prop: 'value',
    event: 'input'
  },
  props: {
    value: {
      // type: Object,
      default: null
    },
    accept: {
      type: String,
      default: ''
    },
    // Instruct input to capture from camera
    capture: {
      type: Boolean,
      default: false
    },
    placeholder: {
      type: String,
      default: () => getComponentConfig(NAME, 'placeholder')
    },
    browseText: {
      type: String,
      default: () => getComponentConfig(NAME, 'browseText')
    },
    dropPlaceholder: {
      type: String,
      default: () => getComponentConfig(NAME, 'dropPlaceholder')
    },
    multiple: {
      type: Boolean,
      default: false
    },
    directory: {
      type: Boolean,
      default: false
    },
    noTraverse: {
      type: Boolean,
      default: false
    },
    noDrop: {
      type: Boolean,
      default: false
    },
    fileNameFormatter: {
      type: Function,
      default: null
    }
  },
  data() {
    return {
      selectedFile: this.multiple ? [] : null,
      dragging: false,
      dropping: false,
      hasFocus: false
    }
  },
  computed: {
    fileNamesFlat() {
      return flattenDeep(this.selectedFile)
        .filter(Boolean)
        .map(file => `${file.$path || ''}${file.name}`)
    },
    selectLabel() {
      // Draging active
      if (this.dragging && this.dropPlaceholder) {
        return this.dropPlaceholder
      }

      // No file chosen
      if (!this.selectedFile || this.selectedFile.length === 0) {
        return this.placeholder
      }

      // Convert selectedFile to an array (if not already one)
      const files = concat(this.selectedFile).filter(Boolean)

      if (this.hasNormalizedSlot('file-name')) {
        // There is a slot for formatting the files/names
        return [
          this.normalizeSlot('file-name', {
            files: files,
            names: this.fileNamesFlat
          })
        ]
      } else {
        // Use the user supplied formatter, or the built in one.
        return isFunction(this.fileNameFormatter)
          ? String(this.fileNameFormatter(files))
          : files.map(file => file.name).join(', ')
      }
    }
  },
  watch: {
    selectedFile(newVal, oldVal) {
      // The following test is needed when the file input is "reset" or the
      // exact same file(s) are selected to prevent an infinite loop.
      // When in `multiple` mode we need to check for two empty arrays or
      // two arrays with identical files
      if (
        newVal === oldVal ||
        (isArray(newVal) &&
          isArray(oldVal) &&
          newVal.length === oldVal.length &&
          newVal.every((v, i) => v === oldVal[i]))
      ) {
        return
      }
      if (!newVal && this.multiple) {
        this.$emit('input', [])
      } else {
        this.$emit('input', newVal)
      }
    },
    value(newVal) {
      if (!newVal || (isArray(newVal) && newVal.length === 0)) {
        this.reset()
      }
    }
  },
  methods: {
    focusHandler(evt) {
      // Bootstrap v4 doesn't have focus styling for custom file input
      // Firefox has a '[type=file]:focus ~ sibling' selector issue,
      // so we add a 'focus' class to get around these bugs
      if (this.plain || evt.type === 'focusout') {
        this.hasFocus = false
      } else {
        // Add focus styling for custom file input
        this.hasFocus = true
      }
    },
    reset() {
      try {
        // Wrapped in try in case IE 11 craps out
        this.$refs.input.value = ''
      } catch (e) {}
      // IE 11 doesn't support setting `input.value` to '' or null
      // So we use this little extra hack to reset the value, just in case.
      // This also appears to work on modern browsers as well.
      this.$refs.input.type = ''
      this.$refs.input.type = 'file'
      this.selectedFile = this.multiple ? [] : null
    },
    onChange(evt) {
      if (!this.dropping) {
        this.onFileChange(evt)
      }
      this.dropping = false
    },
    onFileChange(evt) {
      // Always emit original event
      this.$emit('change', evt)
      // Check if special `items` prop is available on event (drop mode event)
      // Can be disabled by setting no-traverse
      const items = evt.dataTransfer && evt.dataTransfer.items
      /* istanbul ignore if: not supported in JSDOM */
      if (items && !this.noTraverse) {
        const queue = []
        for (let i = 0; i < items.length; i++) {
          const item = items[i].webkitGetAsEntry()
          if (item) {
            queue.push(this.traverseFileTree(item))
          }
        }
        Promise.all(queue).then(filesArr => {
          this.setFiles(arrayFrom(filesArr))
        })
      } else {
        // Normal handling
        let files = arrayFrom(evt.target.files || evt.dataTransfer.files)
        console.log('FILES 1', files)
        files = this.directory ? flattenDeep(files) : files.filter(i => !isArray(i))
        console.log('FILES 2', files)
        this.setFiles(
          files.filter(Boolean).map(f => {
            f.$path = ''
            return f
          })
        )
      }
    },
    traverseFileTree(item, path) /* istanbul ignore next: not supported in JSDOM */ {
      // Based on http://stackoverflow.com/questions/3590058
      return new Promise(resolve => {
        path = path || ''
        if (item.isFile) {
          // Get file
          item.file(file => {
            file.$path = path // Inject $path to file obj
            resolve(file)
          })
        } else if (item.isDirectory) {
          // Get folder contents
          item.createReader().readEntries(entries => {
            const queue = []
            for (let i = 0; i < entries.length; i++) {
              queue.push(this.traverseFileTree(entries[i], `${path}${item.name}/`))
            }
            Promise.all(queue).then(filesArr => {
              resolve(arrayFrom(filesArr))
            })
          })
        }
      })
    },
    setFiles(files = []) {
      if (!files) {
        /* istanbul ignore next: this will probably not happen */
        this.selectedFile = this.multiple ? [] : null
      } else if (this.multiple) {
        this.selectedFile = files
      } else {
        // Return single file object (first one)
        this.selectedFile = files[0] || null
      }
    },
    onReset() {
      // Triggered when the parent form (if any) is reset
      this.selectedFile = this.multiple ? [] : null
    },
    onDragover(evt) /* istanbul ignore next: difficult to test in JSDOM */ {
      evt.preventDefault()
      evt.stopPropagation()
      if (this.noDrop || this.disabled) {
        return
      }
      this.dragging = true
      if (evt.dataTransfer) {
        evt.dataTransfer.dropEffect = 'copy'
      }
    },
    onDragleave(evt) /* istanbul ignore next: difficult to test in JSDOM */ {
      evt.preventDefault()
      evt.stopPropagation()
      this.dragging = false
    },
    onDrop(evt) /* istanbul ignore next: difficult to test in JSDOM */ {
      // Preventing default makes the file input not work with `required`
      // evt.preventDefault()
      evt.stopPropagation()
      if (this.noDrop || this.disabled) {
        return
      }
      this.dragging = false
      if (evt.dataTransfer.files && evt.dataTransfer.files.length > 0) {
        this.dropping = true
        this.onFileChange(evt)
      } else {
        this.dropping = false
      }
    }
  },
  render(h) {
    // Form Input
    const input = h('input', {
      ref: 'input',
      class: [
        {
          'form-control-file': this.plain,
          'custom-file-input': this.custom,
          focus: this.custom && this.hasFocus
        },
        this.stateClass
      ],
      attrs: {
        type: 'file',
        id: this.safeId(),
        name: this.name,
        disabled: this.disabled,
        required: this.required,
        form: this.form || null,
        capture: this.capture || null,
        accept: this.accept || null,
        multiple: this.multiple,
        webkitdirectory: this.directory,
        'aria-required': this.required ? 'true' : null
      },
      on: {
        change: this.onChange,
        focusin: this.focusHandler,
        focusout: this.focusHandler,
        reset: this.onReset
      }
    })

    if (this.plain) {
      return input
    }

    // Overlay Labels
    const label = h(
      'label',
      {
        staticClass: 'custom-file-label',
        class: [this.dragging ? 'dragging' : null],
        attrs: {
          for: this.safeId(),
          'data-browse': this.browseText || null
        }
      },
      this.selectLabel
    )

    // Return rendered custom file input
    return h(
      'div',
      {
        staticClass: 'custom-file b-form-file',
        class: this.stateClass,
        attrs: { id: this.safeId('_BV_file_outer_') },
        on: {
          dragover: this.onDragover,
          dragleave: this.onDragleave,
          drop: this.onDrop
        }
      },
      [input, label]
    )
  }
})

export default BFormFile
