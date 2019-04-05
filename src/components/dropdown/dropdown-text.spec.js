import BDropdownText from './dropdown-text'
import { mount } from '@vue/test-utils'

describe('dropdown-text', () => {
  it('renders with tag "p" by default', async () => {
    const wrapper = mount(BDropdownText)
    expect(wrapper.is('p')).toBe(true)
  })

  it('has custom class "b-dropdown-text"', async () => {
    const wrapper = mount(BDropdownText)
    expect(wrapper.classes()).toContain('b-dropdown-text')
  })

  it('renders with tag "div" when tag=div', async () => {
    const wrapper = mount(BDropdownText, {
      context: {
        props: { tag: 'div' }
      }
    })
    expect(wrapper.is('div')).toBe(true)
    expect(wrapper.classes()).toContain('b-dropdown-text')
  })
})
