'use client'
import { TASK_MARKETPLACE_ADDRESS, TASK_MARKETPLACE_ABI } from '@/config/contracts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useMemo, useEffect } from 'react';
import { useReadContract, useAccount } from 'wagmi';
import { publicClient } from '@/utils/client';
import TaskList from '../tasks/TaskList';
import { formatEther } from 'viem';
import { parseAbiItem } from 'viem';

const DeveloperDashboard = () => {
  const { address } = useAccount();
  const [developerSubmittedEvents, setDeveloperSubmittedEvents] = useState([]);

  const getDeveloperSubmittedEvents = async() => {
    const developerSubmittedLogs = await publicClient.getLogs({
      address: TASK_MARKETPLACE_ADDRESS,
      event: parseAbiItem('event DeveloperSubmitted(uint256 indexed taskId, address indexed developer)'),
      fromBlock: 7386422,
      toBlock: 'latest'
    });
    setDeveloperSubmittedEvents(developerSubmittedLogs.map(log => ({
      taskId: log.args.taskId,
      developer: log.args.developer
    })));
  }

  useEffect(() => {
    const getAllEvents = async() => {
        if(address !== 'undefined') {
          await getDeveloperSubmittedEvents();
        }
    }
    getAllEvents()
  }, [address])

  const { data: assignedTaskIds, isLoading: isLoadingTaskIds } = useReadContract({
    address: TASK_MARKETPLACE_ADDRESS,
    abi: TASK_MARKETPLACE_ABI,
    functionName: 'getAllDeveloperTasks',
    args: [address],
    enabled: !!address,
  });

  const appliedTaskIds = useMemo(() => {
    if (!developerSubmittedEvents) return [];
    return developerSubmittedEvents.map(event => event.taskId);
  }, [developerSubmittedEvents]);

  const { data: appliedTasksDetails, isLoading: isLoadingAppliedTasksDetails } = useReadContract({
    address: TASK_MARKETPLACE_ADDRESS,
    abi: TASK_MARKETPLACE_ABI,
    functionName: 'getTasksDetails',
    args: [appliedTaskIds],
    enabled: appliedTaskIds && appliedTaskIds.length > 0,
  });

  const { data: assignedTasksDetails, isLoading: isLoadingAssignedTasksDetails } = useReadContract({
    address: TASK_MARKETPLACE_ADDRESS,
    abi: TASK_MARKETPLACE_ABI,
    functionName: 'getTasksDetails',
    args: [assignedTaskIds],
    enabled: assignedTaskIds && assignedTaskIds.length > 0,
  });

  const formattedAppliedTasks = useMemo(() => {
    if (!appliedTasksDetails) return [];
    return appliedTaskIds.map((id, index) => ({
      id,
      ...appliedTasksDetails[index],
      hasApplied: true
    }));
  }, [appliedTaskIds, appliedTasksDetails]);

  const formattedAssignedTasks = useMemo(() => {
    if (!assignedTasksDetails) return [];
    return assignedTaskIds.map((id, index) => ({
      id,
      ...assignedTasksDetails[index],
      hasApplied: true
    }));
  }, [assignedTaskIds, assignedTasksDetails]);

  const formattedTasks = useMemo(() => {
    const tasksMap = new Map(
      formattedAssignedTasks.map(task => [task.id.toString(), task])
    );

    formattedAppliedTasks.forEach(task => {
      if (!tasksMap.has(task.id.toString())) {
        tasksMap.set(task.id.toString(), task);
      }
    });

    return Array.from(tasksMap.values());
  }, [formattedAppliedTasks, formattedAssignedTasks]);

  const developerStats = useMemo(() => {
    if (!formattedTasks) return {
      appliedTasks: 0,
      tasksCompleted: 0,
      totalEarned: 0,
      activeTasks: 0,
    };

    return {
      appliedTasks: formattedAppliedTasks.filter(task => task.status === 0).length,
      assignedTasks: formattedTasks.filter(task => task.developer === address).length,
      tasksCompleted: formattedTasks.filter(task => task.status === 4 || task.status === 6).length,
      totalEarned: formattedTasks.reduce((sum, task) => (task.status === 4 || task.status === 6) ? sum + Number(task.developerReward) : 0, 0),
      activeTasks: formattedTasks.filter(task => task.status === 1 || task.status === 2 || task.status === 3).length
    };
  }, [formattedAppliedTasks, formattedAssignedTasks]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-6">Developer Dashboard</h2>

      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Tasks Applied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {developerStats.appliedTasks}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {developerStats.activeTasks}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Completed Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {developerStats.tasksCompleted}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Earned</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatEther(BigInt(developerStats.totalEarned || 0))} ETH
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <h3 className="text-xl font-semibold mb-4">Your Tasks</h3>
        <TaskList 
          tasks={formattedTasks}
          userRole={1}
          isLoading={isLoadingTaskIds || isLoadingAppliedTasksDetails || isLoadingAssignedTasksDetails}
        />
      </div>
    </div>
  );
};

export default DeveloperDashboard; 