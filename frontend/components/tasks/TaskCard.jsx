'use client'
import { useWriteContract, useWaitForTransactionReceipt, useWatchContractEvent, useReadContract } from 'wagmi';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { TASK_MARKETPLACE_ADDRESS, TASK_MARKETPLACE_ABI } from '@/config/contracts';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatEther } from 'viem';
import { useState, useMemo, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { RocketIcon } from "@radix-ui/react-icons"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"

const TaskCard = ({ task, userRole }) => {
  const { toast } = useToast();
  const { address } = useAccount();
  const [transactionHash, setTransactionHash] = useState(null);

  const { data: developerCandidates } = useReadContract({
    address: TASK_MARKETPLACE_ADDRESS,
    abi: TASK_MARKETPLACE_ABI,
    functionName: 'getDeveloperCandidates',
    args: [task.id],
    watch: false,
    enabled: userRole === 1,
  });

  const { data: taskAuditors } = useReadContract({
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

  const { refetch, writeContract } = useWriteContract({
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

  const handleAction = async (action) => {
    writeContract({
      address: TASK_MARKETPLACE_ADDRESS,
      abi: TASK_MARKETPLACE_ABI,
      functionName: action,
      args: [task.id],
    });
  };

  const { isLoading: isTransactionPending, isSuccess: isTransactionSuccess } = useWaitForTransactionReceipt({
    hash: transactionHash,
  });

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
        refetch();
      }
    },
    enabled: !!transactionHash,
  });

  const getStatusBadge = (status) => {
    const statusColors = {
      0: "bg-green-100 text-green-800",
      1: "bg-blue-100 text-blue-800",
      2: "bg-yellow-100 text-yellow-800",
      3: "bg-purple-100 text-purple-800",
      4: "bg-gray-100 text-gray-800",
      5: "bg-red-100 text-red-800"
    };

    const statusText = {
      0: "Open",
      1: "In Progress",
      2: "Under Review",
      3: "Audit Requested",
      4: "Completed",
      5: "Cancelled"
    };

    return (
      <Badge className={statusColors[status]}>
        {statusText[status]}
      </Badge>
    );
  };

  const renderActionButton = () => {
    if (isTransactionPending) {
      return <Button disabled>Processing...</Button>;
    }

    if (userRole === 1 && task.status === 0) {
      return (
        <Button 
          onClick={() => handleAction('applyForTaskAsDeveloper')}
          disabled={hasApplied}
        >
          {hasApplied ? 'Applied' : 'Apply'}
        </Button>
      );
    }
    
    if (userRole === 2 && task.status === 0) {
      return (
        <Button 
          onClick={() => handleAction('applyForTaskAsAuditor')}
          disabled={hasApplied}
        >
          {hasApplied ? 'Applied' : 'Apply as Auditor'}
        </Button>
      );
    }
    
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="truncate">{task?.title || 'No title'}</CardTitle>
          {getStatusBadge(Number(task?.status || 0))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between text-sm">
          <span>Reward: {formattedReward} ETH</span>
          <span>Deadline: {formattedDeadline}</span>
        </div>
      </CardContent>
      <CardFooter className="justify-end">
        {renderActionButton()}
      </CardFooter>
    </Card>
  );
};

export default TaskCard; 