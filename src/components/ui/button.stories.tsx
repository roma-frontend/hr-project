import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';
import { Plus, Trash2, Send } from 'lucide-react';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
    },
    size: { control: 'select', options: ['default', 'sm', 'lg', 'icon'] },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = { args: { children: 'Button' } };
export const Destructive: Story = { args: { children: 'Delete', variant: 'destructive' } };
export const Outline: Story = { args: { children: 'Cancel', variant: 'outline' } };
export const Small: Story = { args: { children: 'Small', size: 'sm' } };
export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Plus className="w-4 h-4 mr-1" /> Create
      </>
    ),
  },
};
export const IconOnly: Story = {
  args: { children: <Trash2 className="w-4 h-4" />, size: 'icon', variant: 'ghost' },
};
export const Loading: Story = { args: { children: 'Sending...', disabled: true } };
