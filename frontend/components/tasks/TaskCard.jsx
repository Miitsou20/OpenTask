'use client'
import { useWriteContract, useWaitForTransactionReceipt, useWatchContractEvent, useReadContract, useAccount} from 'wagmi';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { TASK_MARKETPLACE_ADDRESS, TASK_MARKETPLACE_ABI } from '@/config/contracts';
import CreateTaskModal from './CreateTaskModal';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from 'next/navigation';
import { useState, useMemo } from 'react';
import { formatEther } from 'viem';

const TaskCard = ({ task, userRole }) => {
  const { toast } = useToast();
  const { address } = useAccount();
  const [transactionHash, setTransactionHash] = useState(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const router = useRouter();

  const { data: developerCandidates, refetch: refetchDeveloperCandidates } = useReadContract({
    address: TASK_MARKETPLACE_ADDRESS,
    abi: TASK_MARKETPLACE_ABI,
    functionName: 'getDeveloperCandidates',
    args: [task.id],
    watch: false,
    enabled: userRole === 1,
  });

  const { data: taskAuditors, refetch: refetchTaskAuditors } = useReadContract({
    address: TASK_MARKETPLACE_ADDRESS,
    abi: TASK_MARKETPLACE_ABI,
    functionName: 'getTaskAuditors',
    args: [task.id],
    watch: false,
    enabled: userRole === 2,
  });

  const hasApplied = useMemo(() => {
    if (userRole === 1 && developerCandidates) {
      return developerCandidates.includes(address);
    }
    if (userRole === 2 && taskAuditors) {
      return taskAuditors.includes(address);
    }
    return false;
  }, [userRole, developerCandidates, taskAuditors, address]);

  const formattedReward = task?.reward ? formatEther(BigInt(task.reward)) : '0';
  const formattedDeadline = task?.deadline 
    ? new Date(Number(task.deadline) * 1000).toLocaleDateString()
    : 'No deadline set';

  const { isPending: isSigningPending, writeContract } = useWriteContract({
    mutation: {
      onSuccess: (hash) => {
        setTransactionHash(hash);
        toast({
          title: "Transaction Sent",
          description: "Your application is being processed...",
          duration: 5000,
        });
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || "Transaction failed",
          duration: 5000,
        });
      },
    },
  });

  const { isLoading: isTransactionPending } = useWaitForTransactionReceipt({
    hash: transactionHash,
  });

  const isProcessing = isSigningPending || isTransactionPending;

  const handleAction = async (action) => {
    writeContract({
      address: TASK_MARKETPLACE_ADDRESS,
      abi: TASK_MARKETPLACE_ABI,
      functionName: action,
      args: [task.id],
    });
  };

  useWatchContractEvent({
    address: TASK_MARKETPLACE_ADDRESS,
    abi: TASK_MARKETPLACE_ABI,
    eventName: userRole === 1 ? 'DeveloperSubmitted' : 'AuditorSubmitted',
    onLogs: (logs) => {
      const event = logs[0];
      if (event.transactionHash === transactionHash) {
        toast({
          title: userRole === 1 ? "Developer Submitted!" : "Auditor Submitted!",
          description: "You have applied for this task.",
        });
        setTransactionHash(null);
        refetchDeveloperCandidates();
        refetchTaskAuditors();
      }
    },
    enabled: !!transactionHash,
  });

  const getStatusBadge = (status) => {
    const statusColors = {
        0: "bg-green-100 text-green-800",   // Created
        1: "bg-blue-100 text-blue-800",     // InProgress
        2: "bg-yellow-100 text-yellow-800", // Submitted
        3: "bg-purple-100 text-purple-800", // Disputed
        4: "bg-gray-100 text-gray-800",     // Completed
        5: "bg-red-100 text-red-800",       // Cancelled
        6: "bg-green-100 text-green-800",   // CompletedWithDeveloperWon
        7: "bg-orange-100 text-orange-800"  // CompletedWithProviderWon
    };

    const statusText = {
        0: "Open",
        1: "In Progress",
        2: "Under Review",
        3: "Disputed (Auditor Vote Pending)",
        4: "Completed",
        5: "Cancelled",
        6: "Completed (Developer Won)",
        7: "Completed (Provider Won)"
    };

    return (
        <Badge className={statusColors[status]}>
            {statusText[status]}
        </Badge>
    );
};

  const renderActionButton = () => {
    if (isProcessing) {
      return <Button disabled>Processing...</Button>;
    }

    const taskStatus = Number(task.status);

    if (userRole === 0 && taskStatus === 0) {
      return (
        <Button 
          onClick={(e) => {
            e.stopPropagation();
            setIsUpdateModalOpen(true);
          }}
          disabled={isProcessing}
        >
          Update Deadline
        </Button>
      );
    }

    if (userRole === 1 && taskStatus === 0) {
      return (
        <Button 
          onClick={(e) => {
            e.stopPropagation();
            handleAction('applyForTaskAsDeveloper');
          }}
          disabled={hasApplied || isProcessing}
        >
          {hasApplied ? 'Applied' : 'Apply'}
        </Button>
      );
    }
    
    if (userRole === 2 && taskStatus === 0) {
      return (
        <Button 
          onClick={(e) => {
            e.stopPropagation();
            handleAction('applyForTaskAsAuditor');
          }}
          disabled={hasApplied || isProcessing}
        >
          {hasApplied ? 'Applied' : 'Apply as Auditor'}
        </Button>
      );
    }
    
    return null;
  };

  const handleCardClick = () => {
    router.push(`/tasks/${task.id}`);
  };

  const handleModalClose = () => {
    setIsUpdateModalOpen(false);
    refetchDeveloperCandidates();
    refetchTaskAuditors();
  };

  return (
    <>
      <Card 
        className="cursor-pointer hover:shadow-lg transition-shadow flex flex-col min-h-[400px]"
        onClick={handleCardClick}
      >
        <CardHeader>
          <div className="flex justify-between items-start">
            <CardTitle className="truncate">{task?.title || 'No title'}</CardTitle>
            {getStatusBadge(Number(task?.status || 0))}
          </div>
        </CardHeader>
        <CardContent className="flex-grow">
          <div className="flex flex-col space-y-4">
            <div className="space-y-1">
              <span className="font-medium text-gray-700 dark:text-gray-300">Description:</span>
              <p className="text-sm text-gray-600 dark:text-gray-400 ml-2">{task?.description}</p>
            </div>

            <div className="space-y-1">
              <span className="font-medium text-gray-700 dark:text-gray-300">Reward:</span>
              <p className="text-sm text-gray-600 dark:text-gray-400 ml-2">{formattedReward} ETH</p>
            </div>

            <div className="space-y-1">
              <span className="font-medium text-gray-700 dark:text-gray-300">Deadline:</span>
              <p className="text-sm text-gray-600 dark:text-gray-400 ml-2">{formattedDeadline}</p>
            </div>

            {userRole === 0 && (
              <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <div className="space-y-1">
                  <span className="font-medium text-gray-700 dark:text-gray-300">Developer Candidates:</span>
                  <p className="text-sm text-gray-600 dark:text-gray-400 ml-2">{developerCandidates?.length || 0}</p>
                </div>

                <div className="space-y-1">
                  <span className="font-medium text-gray-700 dark:text-gray-300">Auditor Candidates:</span>
                  <p className="text-sm text-gray-600 dark:text-gray-400 ml-2">{taskAuditors?.length || 0}/3</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="mt-auto justify-end">
          {renderActionButton()}
        </CardFooter>
      </Card>
      
      {isUpdateModalOpen && (
        <CreateTaskModal
          open={isUpdateModalOpen}
          onClose={handleModalClose}
          task={task}
          isUpdateMode={true}
        />
      )}
    </>
  );
};

export default TaskCard; 