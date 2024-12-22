'use client'
import { TASK_MARKETPLACE_ADDRESS, TASK_MARKETPLACE_ABI } from '@/config/contracts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useReadContract, useAccount } from 'wagmi';
import { useState, useMemo, useEffect } from 'react';
import TaskList from '../tasks/TaskList';
import { formatEther } from 'viem';
import { publicClient } from '@/utils/client';
import { parseAbiItem } from 'viem';

const DeveloperDashboard = () => {
  const { address } = useAccount();
  const [developerSubmittedEvents, setDeveloperSubmittedEvents] = useState([]);

  const { data: taskCount } = useReadContract({
    address: TASK_MARKETPLACE_ADDRESS,
    abi: TASK_MARKETPLACE_ABI,
    functionName: 'taskCount',
    watch: false,
  });

  const getDeveloperSubmittedEvents = async() => {
    const developerSubmittedLogs = await publicClient.getLogs({
      address: TASK_MARKETPLACE_ADDRESS,
      event: parseAbiItem('event DeveloperSubmitted(uint256 indexed taskId, address indexed developer)'),
      fromBlock: 0n,
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

  const appliedTaskIds = useMemo(() => {
    if (!developerSubmittedEvents) return [];
    return developerSubmittedEvents.map(event => event.taskId);
  }, [developerSubmittedEvents]);

  const { data: tasksDetails, isLoading: isLoadingDetails } = useReadContract({
    address: TASK_MARKETPLACE_ADDRESS,
    abi: TASK_MARKETPLACE_ABI,
    functionName: 'getTasksDetails',
    args: [appliedTaskIds],
    watch: false,
    enabled: appliedTaskIds.length > 0,
  });

  const formattedTasks = useMemo(() => {
    if (!tasksDetails) return [];
    return appliedTaskIds.map((id, index) => ({
      id,
      ...tasksDetails[index],
      hasApplied: true
    }));
  }, [appliedTaskIds, tasksDetails]);

  const developerStats = useMemo(() => {
    if (!formattedTasks) return {
      tasksCompleted: 0,
      totalEarned: 0,
      activeTasks: 0,
      appliedTasks: 0
    };

    return formattedTasks.reduce((stats, task) => {
      if (task.status === 4) {
        stats.tasksCompleted++;
        stats.totalEarned += Number(task.developerReward);
      } else if (task.status === 1) {
        stats.activeTasks++;
      }
      stats.appliedTasks++;
      return stats;
    }, {
      tasksCompleted: 0,
      totalEarned: 0,
      activeTasks: 0,
      appliedTasks: 0
    });
  }, [formattedTasks]);

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
          isLoading={isLoadingDetails}
        />
      </div>
    </div>
  );
};

export default DeveloperDashboard; 