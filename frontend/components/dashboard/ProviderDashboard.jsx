'use client'
import { TASK_MARKETPLACE_ADDRESS, TASK_MARKETPLACE_ABI } from '@/config/contracts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useReadContract, useAccount, useWatchContractEvent } from 'wagmi';
import CreateTaskModal from '../tasks/CreateTaskModal';
import { useState, useMemo, useEffect } from 'react';
import { RocketIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import TaskList from '../tasks/TaskList';
import { formatEther } from 'viem';

const ProviderDashboard = () => {
  const { toast } = useToast();
  const { address } = useAccount();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data: taskIds, isLoading: isLoadingTaskIds, refetch: refetchTaskIds } = useReadContract({
    address: TASK_MARKETPLACE_ADDRESS,
    abi: TASK_MARKETPLACE_ABI,
    functionName: 'getTasksByProvider',
    args: [address],
    watch: false,
  });

  const { data: tasksDetails, isLoading: isLoadingDetails, refetch: refetchTaskDetails } = useReadContract({
    address: TASK_MARKETPLACE_ADDRESS,
    abi: TASK_MARKETPLACE_ABI,
    functionName: 'getTasksDetails',
    args: [taskIds || []],
    watch: false,
    enabled: !!taskIds && taskIds.length > 0,
  });

  useWatchContractEvent({
    address: TASK_MARKETPLACE_ADDRESS,
    abi: TASK_MARKETPLACE_ABI,
    eventName: 'TaskCreated',
    onLogs: async (logs) => {
      const event = logs[0];
      if (event.args.provider === address) {
        toast({
          title: "Task Created!",
          description: `New task created with ID: ${event.args.taskId}`,
          duration: 5000,
        });
        await refetchTaskIds();
        await refetchTaskDetails();
      }
    },
  });

  const formattedTasks = useMemo(() => {
    if (!taskIds || !tasksDetails) return [];
    return taskIds.map((id, index) => ({
      id,
      ...tasksDetails[index]
    }));
  }, [taskIds, tasksDetails]);

  const handleModalClose = async () => {
    setIsCreateModalOpen(false);
    await refetchTaskIds();
    await refetchTaskDetails();
  };

  const providerStats = useMemo(() => {
    if (!tasksDetails) return {
      activeTasks: 0,
      completedTasks: 0,
      totalSpent: 0
    };

    return tasksDetails.reduce((stats, task) => {
      if (task.status === 1 || task.status === 2 || task.status === 3) {
        stats.activeTasks++;
      } else if (task.status === 4) {
        stats.completedTasks++;
        stats.totalSpent += Number(task.reward);
      }
      return stats;
    }, {
      activeTasks: 0,
      completedTasks: 0,
      totalSpent: 0
    });
  }, [tasksDetails]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Provider Dashboard</h2>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          Create New Task
        </Button>
      </div>

      {(isLoadingTaskIds || isLoadingDetails) && (
        <Alert>
          <RocketIcon className="h-4 w-4" />
          <AlertTitle>Loading...</AlertTitle>
          <AlertDescription>
            Fetching your task information...
          </AlertDescription>
        </Alert>
      )}

      <div className="grid md:grid-cols-4 gap-4 mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {taskIds?.length || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {providerStats?.activeTasks || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Completed Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {providerStats?.completedTasks || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {providerStats?.totalSpent ? formatEther(providerStats.totalSpent) : '0'} ETH
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <TaskList 
          tasks={formattedTasks}
          userRole={0}
          isLoading={isLoadingTaskIds || isLoadingDetails}
        />
      </div>

      <CreateTaskModal 
        open={isCreateModalOpen} 
        onClose={handleModalClose}
      />
    </div>
  );
};

export default ProviderDashboard; 