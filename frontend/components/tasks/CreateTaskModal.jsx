'use client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TASK_MARKETPLACE_ADDRESS, TASK_MARKETPLACE_ABI } from '@/config/contracts';
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useWriteContract, useWaitForTransactionReceipt, useWatchContractEvent } from 'wagmi';
import { parseEther } from 'viem';
import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RocketIcon } from "@radix-ui/react-icons";

const CreateTaskModal = ({ open, onClose }) => {
  const { toast } = useToast();
  const [transactionHash, setTransactionHash] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    reward: '',
    deadline: ''
  });

  const { isLoading: isCreatingTask, isSuccess: isTaskCreated } = useWaitForTransactionReceipt({
    hash: transactionHash,
  });

  useEffect(() => {
    if (isTaskCreated) {
      toast({
        title: "Success!",
        description: "Task has been created successfully.",
        duration: 5000,
      });
      
      setFormData({
        title: '',
        description: '',
        reward: '',
        deadline: ''
      });
      
      setTransactionHash(null);
      
      setTimeout(() => {
        onClose();
      }, 2000);
    }
  }, [isTaskCreated, onClose, toast]);

  useWatchContractEvent({
    address: TASK_MARKETPLACE_ADDRESS,
    abi: TASK_MARKETPLACE_ABI,
    eventName: 'TaskCreated',
    onLogs: (logs) => {
      const event = logs[0];
      toast({
        title: "Task Created!",
        description: `Task ID: ${event.args.taskId}, Reward: ${formatEther(event.args.reward)} ETH`,
        duration: 5000,
      });
    },
  });

  const { error, isPending, writeContract } = useWriteContract({
    mutation: {
      onSuccess: (hash) => {
        setTransactionHash(hash);
        toast({
          title: "Transaction Sent",
          description: "Your task creation request is being processed...",
          duration: 5000,
        });
      },
      onError: (error) => {
        console.error("Contract Error:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || "Failed to create task",
          duration: 5000,
        });
      },
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const deadline = Math.floor(new Date(formData.deadline).getTime() / 1000);
      const reward = parseEther(formData.reward);
      
      writeContract({
        address: TASK_MARKETPLACE_ADDRESS,
        abi: TASK_MARKETPLACE_ABI,
        functionName: 'createTask',
        args: [formData.title, formData.description, deadline, reward]
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create task: " + error.message,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
        </DialogHeader>

        {transactionHash && !isTaskCreated && (
          <div className="mb-6 text-center">
            <p className="text-sm text-gray-600">Transaction Hash:</p>
            <a 
              href={`https://sepolia.etherscan.io/tx/${transactionHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-700 break-all font-mono text-sm"
            >
              {transactionHash}
            </a>
          </div>
        )}

        <div className="mt-4">
          {isCreatingTask && (
            <Alert>
              <RocketIcon className="h-4 w-4" />
              <AlertTitle>Creating Task...</AlertTitle>
              <AlertDescription>
                Please wait for the transaction to complete.
              </AlertDescription>
            </Alert>
          )}
          
          {isTaskCreated && (
            <Alert className="bg-green-50">
              <AlertTitle>Task Created!</AlertTitle>
              <AlertDescription>
                Your task has been successfully created. The modal will close shortly...
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {error.shortMessage || "Failed to create task"}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              placeholder="Task title"
              required
              disabled={isPending || isCreatingTask}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Task description"
              required
              disabled={isPending || isCreatingTask}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Reward (ETH)</label>
            <Input
              type="number"
              step="0.01"
              value={formData.reward}
              onChange={(e) => setFormData({...formData, reward: e.target.value})}
              placeholder="0.1"
              required
              disabled={isPending || isCreatingTask}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Deadline</label>
            <Input
              type="datetime-local"
              value={formData.deadline}
              onChange={(e) => setFormData({...formData, deadline: e.target.value})}
              required
              disabled={isPending || isCreatingTask}
            />
          </div>
          <div className="flex justify-end gap-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              disabled={isPending || isCreatingTask}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isPending || isCreatingTask}
            >
              {isPending || isCreatingTask ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTaskModal; 