'use client'
import { TASK_MARKETPLACE_ADDRESS, TASK_MARKETPLACE_ABI } from '@/config/contracts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useReadContract, useAccount } from 'wagmi';
import { useToast } from "@/hooks/use-toast";
import TaskList from '../tasks/TaskList';
import { formatEther } from 'viem';
import { useMemo, useEffect, useState } from 'react';
import { publicClient } from '@/utils/client';
import { parseAbiItem } from 'viem';

const AuditorDashboard = () => {
  const { toast } = useToast();
  const { address } = useAccount();
  const [auditorSubmittedEvents, setAuditorSubmittedEvents] = useState([]);

  const getAuditorSubmittedEvents = async() => {
    const auditorSubmittedLogs = await publicClient.getLogs({
      address: TASK_MARKETPLACE_ADDRESS,
      event: parseAbiItem('event AuditorSubmitted(uint256 indexed taskId, address indexed auditor)'),
      fromBlock: 0n,
      toBlock: 'latest'
    });
    setAuditorSubmittedEvents(auditorSubmittedLogs.map(log => ({
      taskId: log.args.taskId,
      auditor: log.args.auditor
    })));
  }

  useEffect(() => {
    const getAllEvents = async() => {
        if(address !== 'undefined') {
          await getAuditorSubmittedEvents();
        }
    }
    getAllEvents()
  }, [address])

  const appliedTaskIds = useMemo(() => {
    if (!auditorSubmittedEvents) return [];
    return auditorSubmittedEvents.map(event => event.taskId);
  }, [auditorSubmittedEvents]);

  // const { data: taskIds, isLoading: isLoadingAssigned } = useReadContract({
  //   address: TASK_MARKETPLACE_ADDRESS,
  //   abi: TASK_MARKETPLACE_ABI,
  //   functionName: 'getTasksByAuditor',
  //   args: [address],
  //   watch: false,
  // });

  const { data: tasksDetails, isLoading: isLoadingDetails } = useReadContract({
    address: TASK_MARKETPLACE_ADDRESS,
    abi: TASK_MARKETPLACE_ABI,
    functionName: 'getTasksDetails',
    args: [appliedTaskIds],
    watch: false,
    enabled: appliedTaskIds.length > 0,
  });
  console.log('tasksDetails', tasksDetails);


  const formattedTasks = useMemo(() => {
    if (!appliedTaskIds || !tasksDetails) return [];
    return appliedTaskIds.map((id, index) => ({
      id,
      ...tasksDetails[index]
    }));
  }, [appliedTaskIds, tasksDetails]);

  const auditorStats = useMemo(() => {
    if (!formattedTasks) return {
      reviewsCompleted: 0,
      activeReviews: 0,
      totalEarned: 0,
      appliedReviews: 0
    };

    return formattedTasks.reduce((stats, task) => {
      if (task.status === 4) { // Completed
        stats.reviewsCompleted++;
        stats.totalEarned += Number(task.auditorReward);
      } else if (task.status === 2) { // In Review
        stats.activeReviews++;
      }
      stats.appliedReviews++;
      return stats;
    }, {
      reviewsCompleted: 0,
      activeReviews: 0,
      totalEarned: 0,
      appliedReviews: 0
    });
  }, [formattedTasks]);


  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-6">Auditor Dashboard</h2>

      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Reviews Applied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {auditorStats.appliedReviews}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Reviews</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {auditorStats.activeReviews}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Completed Reviews</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {auditorStats.reviewsCompleted}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Earned</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatEther(BigInt(auditorStats.totalEarned || 0))} ETH
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <h3 className="text-xl font-semibold mb-4">Your Reviews</h3>
        <TaskList 
          tasks={formattedTasks}
          userRole={2}
          isLoading={isLoadingDetails}
        />
      </div>
    </div>
  );
};

export default AuditorDashboard; 