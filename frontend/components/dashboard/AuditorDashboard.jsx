'use client'
import { TASK_MARKETPLACE_ADDRESS, TASK_MARKETPLACE_ABI } from '@/config/contracts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useReadContract, useAccount } from 'wagmi';
import TaskList from '../tasks/TaskList';
import { formatEther } from 'viem';
import { useMemo } from 'react';


const AuditorDashboard = () => {
  const { address } = useAccount();

  const { data: appliedTaskIds } = useReadContract({
    address: TASK_MARKETPLACE_ADDRESS,
    abi: TASK_MARKETPLACE_ABI,
    functionName: 'getAllAuditorTasks',
    args: [address],
    enabled: !!address,
  });

  const { data: appliedTasksDetails, isLoading: isLoadingDetails } = useReadContract({
    address: TASK_MARKETPLACE_ADDRESS,
    abi: TASK_MARKETPLACE_ABI,
    functionName: 'getTasksDetails',
    args: [[appliedTaskIds]],
    enabled: appliedTaskIds && appliedTaskIds.length > 0,
  });

  const formattedTasks = useMemo(() => {
    if (!appliedTaskIds || !appliedTasksDetails) return [];
    return appliedTaskIds.map((id, index) => ({
      id,
      ...appliedTasksDetails[index]
    }));
  }, [appliedTaskIds, appliedTasksDetails]);

  const auditorStats = useMemo(() => {
    if (!formattedTasks) return {
      reviewsCompleted: 0,
      activeReviews: 0,
      totalEarned: BigInt(0),
      appliedReviews: formattedTasks?.length || 0
    };

    return formattedTasks.reduce((stats, task) => {
      return {
        appliedReviews: stats.appliedReviews + 1,
        activeReviews: stats.activeReviews + (task.status === 3 ? 1 : 0),
        reviewsCompleted: stats.reviewsCompleted + 
          ((task.status === 6 || task.status === 7) ? 1 : 0),
        totalEarned: stats.totalEarned + 
          ((task.status === 6 || task.status === 7) ? 
            BigInt(task.auditorReward || 0) : BigInt(0))
      };
    }, {
      reviewsCompleted: 0,
      activeReviews: 0,
      totalEarned: BigInt(0),
      appliedReviews: 0
    });
  }, [formattedTasks, address]);


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