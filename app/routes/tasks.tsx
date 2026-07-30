import { useState } from 'react'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { LoaderCircle, Plus, Trash2 } from 'lucide-react'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'
import { createTaskSchema, type CreateTaskInput } from '@/features/tasks/schemas'
import { useTasks } from '@/features/tasks/hooks/useTasks'
import { ACHIEVEMENT_MAP } from '@/features/achievements/definitions'
import { useCelebration } from '@/features/celebration/CelebrationContext'
import type { Task } from '@/db/schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'

export const Route = createFileRoute('/tasks')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
  },
  component: TasksPage,
})

const priorityStyles: Record<Task['priority'], string> = {
  high: 'bg-destructive/15 text-destructive border-destructive/20',
  medium: 'bg-accent/15 text-accent-foreground border-accent/20',
  low: 'bg-primary/10 text-primary border-primary/20',
}

type Filter = 'all' | 'active' | 'completed'

function TasksPage() {
  const { tasks, isLoading, createTask, toggleTask, deleteTask, isCreating } = useTasks()
  const { celebrate } = useCelebration()
  const [filter, setFilter] = useState<Filter>('all')
  const [taskPendingDelete, setTaskPendingDelete] = useState<Task | null>(null)

  const form = useForm<CreateTaskInput>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: { title: '', description: '', priority: 'medium', dueDate: '' },
  })

  async function onSubmit(values: CreateTaskInput) {
    try {
      await createTask(values)
      form.reset({ title: '', description: '', priority: 'medium', dueDate: '' })
      toast.success('Task added')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add task')
    }
  }

  async function handleToggle(task: Task) {
    try {
      const result = await toggleTask({ id: task.id, completed: !task.completed })
      for (const key of result.unlockedAchievements) {
        const definition = ACHIEVEMENT_MAP.get(key)
        if (definition) {
          celebrate({ type: 'achievement', title: definition.title, description: definition.description })
        }
      }
    } catch {
      toast.error('Failed to update task')
    }
  }

  async function confirmDelete() {
    if (!taskPendingDelete) return
    try {
      await deleteTask({ id: taskPendingDelete.id })
      toast.success('Task deleted')
    } catch {
      toast.error('Failed to delete task')
    } finally {
      setTaskPendingDelete(null)
    }
  }

  const filteredTasks = tasks.filter((task) => {
    if (filter === 'active') return !task.completed
    if (filter === 'completed') return task.completed
    return true
  })

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 font-heading text-2xl font-semibold text-foreground">Tasks</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-heading text-base text-foreground">Add a task</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="What do you need to do?" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isCreating} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                  {isCreating ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  Add
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-secondary" />
      ) : filteredTasks.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">No tasks here yet.</p>
          <Button variant="outline" size="sm" asChild className="mt-3">
            <Link to="/focus">Start a focus session</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
            >
              <Checkbox checked={task.completed} onCheckedChange={() => handleToggle(task)} />
              <div className="flex-1">
                <p className={task.completed ? 'text-sm text-muted-foreground line-through' : 'text-sm text-foreground'}>
                  {task.title}
                </p>
                {task.description && <p className="text-xs text-muted-foreground">{task.description}</p>}
              </div>
              {task.dueDate && (
                <span className="text-xs text-muted-foreground">{new Date(task.dueDate).toLocaleDateString()}</span>
              )}
              <Badge variant="outline" className={priorityStyles[task.priority]}>
                {task.priority}
              </Badge>
              <Button variant="ghost" size="icon" onClick={() => setTaskPendingDelete(task)} aria-label="Delete task">
                <Trash2 className="size-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!taskPendingDelete} onOpenChange={(open) => !open && setTaskPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete task?</DialogTitle>
            <DialogDescription>
              This will permanently delete &quot;{taskPendingDelete?.title}&quot;. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
