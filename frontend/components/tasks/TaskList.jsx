'use client'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RocketIcon } from "@radix-ui/react-icons";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from 'react';
import TaskCard from './TaskCard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TaskList = ({ tasks, userRole, isLoading }) => {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter(task => {
      if (search && task.description) {
        return task.description.toLowerCase().includes(search.toLowerCase());
      }
      if (filter === 'all') return true;
      return task.status?.toString() === filter;
    });
  }, [tasks, search, filter]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Available Tasks</h2>
        <div className="flex gap-4">
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="0">Open</SelectItem>
              <SelectItem value="1">In Progress</SelectItem>
              <SelectItem value="2">Submitted</SelectItem>
              <SelectItem value="3">Disputed</SelectItem>
              <SelectItem value="4">Completed</SelectItem>
              <SelectItem value="5">Cancelled</SelectItem>
              <SelectItem value="6">Completed With Developer Won</SelectItem>
              <SelectItem value="7">Completed With Provider Won</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && (
        <Alert>
          <RocketIcon className="h-4 w-4" />
          <AlertTitle>Loading...</AlertTitle>
          <AlertDescription>
            Fetching tasks...
          </AlertDescription>
        </Alert>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTasks.map((task) => (
          <TaskCard 
            key={task.id}
            task={task}
            userRole={userRole}
          />
        ))}
      </div>
    </div>
  );
};

export default TaskList; 