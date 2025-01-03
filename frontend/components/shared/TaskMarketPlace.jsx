import { TASK_MARKETPLACE_ADDRESS, TASK_MARKETPLACE_ABI } from '@/config/contracts';
import { SBT_ROLE_ADDRESS, SBT_ROLE_ABI } from '@/config/contracts';
import { buttonVariants } from "@/components/ui/button";
import { useAccount, useReadContract } from 'wagmi';
import LandingPage from '../home/LandingPage';
import TaskList from '../tasks/TaskList';
import { useMemo } from 'react';
import Link from 'next/link';

const TaskMarketPlace = () => {
  const { isConnected, address } = useAccount();

  const { data: userRole } = useReadContract({
    address: SBT_ROLE_ADDRESS,
    abi: SBT_ROLE_ABI,
    functionName: 'getRole',
    args: [address],
    enabled: !!address
  });

  const { data: taskCount } = useReadContract({
    address: TASK_MARKETPLACE_ADDRESS,
    abi: TASK_MARKETPLACE_ABI,
    functionName: 'taskCount',
  });

  const lastTenTaskIds = useMemo(() => {
    if (!taskCount) return [];
    const count = Number(taskCount);
    const start = Math.max(0, count - 10);
    return Array.from({ length: count - start }, (_, i) => start + i);
  }, [taskCount]);

  const { data: tasksDetails, isLoading } = useReadContract({
    address: TASK_MARKETPLACE_ADDRESS,
    abi: TASK_MARKETPLACE_ABI,
    functionName: 'getTasksDetails',
    args: [lastTenTaskIds],
    enabled: lastTenTaskIds.length > 0,
  });

  const formattedTasks = useMemo(() => {
    if (!lastTenTaskIds || !tasksDetails) return [];
    return lastTenTaskIds.map((id, index) => ({
      id,
      ...tasksDetails[index]
    }));
  }, [lastTenTaskIds, tasksDetails]);

  if (!isConnected) {
    return <LandingPage />;
  }
  return (
    <div className="container mx-auto px-4 py-8">
      {userRole === undefined && (
        <div className="flex flex-col items-center justify-center mb-8">
          <h1 className="text-3xl font-bold mb-8">You need to create a role to start interacting with the platform</h1>
          <Link 
            href="/dashboard" 
            className={buttonVariants({
              variant: "default",
              size: "lg",
              className: "font-semibold px-8 py-3 hover:scale-105 transition-transform"
            })}
          >
          Go to Dashboard
          </Link>
        </div>
      )}
      <h1 className="text-3xl font-bold mb-8">Checkout our latest tasks created by our providers</h1>
    <TaskList 
        tasks={formattedTasks}
        userRole={userRole || 0}
        isLoading={isLoading}
      />
    </div>
  );
};

export default TaskMarketPlace;