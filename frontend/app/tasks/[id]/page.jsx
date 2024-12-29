'use client'
import {
    TASK_MARKETPLACE_ADDRESS,
    TASK_MARKETPLACE_ABI,
    SBT_ACHIEVEMENT_ADDRESS,
    SBT_ACHIEVEMENT_ABI,
    SBT_REDFLAG_ADDRESS,
    SBT_REDFLAG_ABI,
    TASK_ESCROW_ABI
} from '@/config/contracts';
import { useReadContract, useAccount, useWriteContract, useWatchContractEvent, useBalance, useWaitForTransactionReceipt } from 'wagmi';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatEther } from 'viem';
import { useState } from 'react';

const truncateAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const DeveloperStats = ({ address }) => {
    const { data: completedTasks } = useReadContract({
        address: SBT_ACHIEVEMENT_ADDRESS,
        abi: SBT_ACHIEVEMENT_ABI,
        functionName: 'getCompletedTaskCount',
        args: [address],
        watch: false,
    });

    const { data: redFlags } = useReadContract({
        address: SBT_REDFLAG_ADDRESS,
        abi: SBT_REDFLAG_ABI,
        functionName: 'getRedFlagCount',
        args: [address],
        watch: false,
    });

    return (
        <div className="flex gap-4 mt-2">
        <div className="flex items-center">
            <Badge variant="secondary" className="bg-green-100">
            ✓ {Number(completedTasks || 0)} Tasks
            </Badge>
        </div>
        <div className="flex items-center">
            <Badge variant="secondary" className="bg-red-100">
            ⚠ {Number(redFlags || 0)} Flags
            </Badge>
        </div>
        </div>
    );
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const TaskPage = ({ params }) => {
    const { address } = useAccount();
    const { toast } = useToast();
    const [transactionHash, setTransactionHash] = useState(null);
    const taskId = params.id;

    const { isLoading } = useWaitForTransactionReceipt({
        hash: transactionHash,
    });

    const { data: developerCandidates } = useReadContract({
        address: TASK_MARKETPLACE_ADDRESS,
        abi: TASK_MARKETPLACE_ABI,
        functionName: 'getDeveloperCandidates',
        args: [taskId],
        watch: true,
    });

    const { data: taskDetails, isLoading: isTaskDetailsLoading, refetch: refetchTaskDetails } = useReadContract({
        address: TASK_MARKETPLACE_ADDRESS,
        abi: TASK_MARKETPLACE_ABI,
        functionName: 'getTasksDetails',
        args: [[taskId]],
        watch: true,
    });

    const task = taskDetails?.[0];

    const { writeContract } = useWriteContract({
        mutation: {
        onSuccess: (hash) => {
            setTransactionHash(hash);
            toast({
                title: "Transaction Sent",
                description: "Developer assignment is being processed...",
                duration: 5000,
            });
        },
        onError: (error) => {
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message || "Failed to assign developer",
                duration: 5000,
            });
        },
        },
    });

    useWatchContractEvent({
        address: TASK_MARKETPLACE_ADDRESS,
        abi: TASK_MARKETPLACE_ABI,
        eventName: 'DeveloperSubmitted',
        onLogs: async (logs) => {
            const event = logs[0];
            if (event.transactionHash === transactionHash) {
                toast({
                    title: "Developer Submitted!",
                    description: `A developer has submitted for task with ID: ${event.args.taskId}`,
                    duration: 5000,
                });
                setTransactionHash(null);
                refetchTaskDetails();
            }
        },
        enabled: !!transactionHash,
    });

    useWatchContractEvent({
        address: TASK_MARKETPLACE_ADDRESS,
        abi: TASK_MARKETPLACE_ABI,
        eventName: 'AuditorSubmitted',
        onLogs: async (logs) => {
            const event = logs[0];
            if (event.transactionHash === transactionHash) {
                toast({
                    title: "Auditor Submitted!",
                    description: `An auditor has submitted for task with ID: ${event.args.taskId}`,
                    duration: 5000,
                });
                setTransactionHash(null);
                refetchTaskDetails();
            }
        },
        enabled: !!transactionHash,
    });

    useWatchContractEvent({
        address: TASK_MARKETPLACE_ADDRESS,
        abi: TASK_MARKETPLACE_ABI,
        eventName: 'DeveloperAssigned',
        onLogs: async (logs) => {
            const event = logs[0];
            if (event.transactionHash === transactionHash) {
                toast({
                    title: "Developer Assigned!",
                    description: `New developer assigned to task with ID: ${event.args.taskId}`,
                    duration: 5000,
                });
                setTransactionHash(null);
                refetchTaskDetails();
            }
        },
        enabled: !!transactionHash,
    });

    useWatchContractEvent({
        address: TASK_MARKETPLACE_ADDRESS,
        abi: TASK_MARKETPLACE_ABI,
        eventName: 'TaskStarted',
        onLogs: async (logs) => {
            const event = logs[0];
            if (event.transactionHash === transactionHash) {
                toast({
                    title: "Task Started!",
                    description: "The task has been started successfully.",
                    duration: 5000,
                });
                setTransactionHash(null);
                refetchTaskDetails();
            }
        },
        enabled: !!transactionHash,
    });

    useWatchContractEvent({
        address: TASK_MARKETPLACE_ADDRESS,
        abi: TASK_MARKETPLACE_ABI,
        eventName: 'WorkSubmitted',
            onLogs: async (logs) => {
                const event = logs[0];
                if (event.transactionHash === transactionHash) {
                    toast({
                        title: "Work Submitted!",
                        description: "Your work has been submitted successfully.",
                        duration: 5000,
                    });
                    setTransactionHash(null);
                    refetchTaskDetails();
                }
            },
        enabled: !!transactionHash,
    });

    useWatchContractEvent({
        address: TASK_MARKETPLACE_ADDRESS,
        abi: TASK_MARKETPLACE_ABI,
        eventName: 'WorkAccepted',
        onLogs: async (logs) => {
            const event = logs[0];
            if (event.transactionHash === transactionHash) {
                toast({
                    title: "Work Accepted!",
                    description: "The work has been accepted successfully.",
                    duration: 5000,
                });
                setTransactionHash(null);
                refetchTaskDetails();
            }
        },
        enabled: !!transactionHash,
    });

    useWatchContractEvent({
        address: task?.escrow,
        abi: TASK_ESCROW_ABI,
        eventName: 'DeveloperPaid',
        onLogs: async (logs) => {
            const event = logs[0];
            if (event.transactionHash === transactionHash) {
                toast({
                    title: "Payment Received!",
                    description: `Successfully received ${formatEther(event.args.amount)} ETH`,
                    duration: 5000,
                });
                setTransactionHash(null);
                refetchTaskDetails();
                refetchEscrowBalance();
            }
        },
        enabled: !!task?.escrow,
    });

    useWatchContractEvent({
        address: task?.escrowAddress,
        abi: TASK_ESCROW_ABI,
        eventName: 'AuditorPaid',
        onLogs: async (logs) => {
            const event = logs[0];
            if (event.transactionHash === transactionHash) {
                toast({
                    title: "Auditor Payment Received!",
                    description: `Successfully received ${formatEther(event.args.amount)} ETH`,
                    duration: 5000,
                });
                setTransactionHash(null);
                refetchTaskDetails();
                refetchEscrowBalance();
            }
        },
        enabled: !!task?.escrowAddress,
    });

    useWatchContractEvent({
        address: task?.escrowAddress,
        abi: TASK_ESCROW_ABI,
        eventName: 'ProviderRefunded',
        onLogs: async (logs) => {
            const event = logs[0];
            if (event.transactionHash === transactionHash) {
                toast({
                    title: "Refund Received!",
                    description: `Successfully refunded ${formatEther(event.args.amount)} ETH`,
                    duration: 5000,
                });
                setTransactionHash(null);
                refetchTaskDetails();
                refetchEscrowBalance();
            }
        },
        enabled: !!task?.escrowAddress,
    });

    useWatchContractEvent({
        address: TASK_MARKETPLACE_ADDRESS,
        abi: TASK_MARKETPLACE_ABI,
        eventName: 'DeveloperPenalized',
        onLogs: async (logs) => {
            const event = logs[0];
            if (event.transactionHash === transactionHash) {
                toast({
                    title: "Developer Penalized",
                    description: "The developer has been penalized for missing the deadline",
                    duration: 5000,
                });
                setTransactionHash(null);
                refetchTaskDetails();
            }
        },
        enabled: !!transactionHash,
    });

    useWatchContractEvent({
        address: TASK_MARKETPLACE_ADDRESS,
        abi: TASK_MARKETPLACE_ABI,
        eventName: 'DisputeInitiated',
        onLogs: async (logs) => {
            const event = logs[0];
            if (event.transactionHash === transactionHash) {
                toast({
                    title: "Dispute Initiated",
                    description: "A dispute has been opened for this task",
                    duration: 5000,
                });
                setTransactionHash(null);
                refetchTaskDetails();
            }
        },
        enabled: !!transactionHash,
    });

    useWatchContractEvent({
        address: TASK_MARKETPLACE_ADDRESS,
        abi: TASK_MARKETPLACE_ABI,
        eventName: 'AuditorVoteSubmitted',
        onLogs: async (logs) => {
            const event = logs[0];
            if (event.transactionHash === transactionHash) {
                toast({
                    title: "Vote Submitted",
                    description: "Your vote has been recorded for this task",
                    duration: 5000,
                });
                setTransactionHash(null);
                refetchTaskDetails();
                refetchAuditorVote();
            }
        },
        enabled: !!transactionHash,
    });

    useWatchContractEvent({
        address: TASK_MARKETPLACE_ADDRESS,
        abi: TASK_MARKETPLACE_ABI,
        eventName: 'DisputeResolved',
        onLogs: async (logs) => {
            const event = logs[0];
            if (event.args.taskId === taskId) {
                toast({
                    title: "Dispute Resolved!",
                    description: `The dispute has been resolved in favor of the ${event.args.developerWon ? 'developer' : 'provider'}`,
                    duration: 5000,
                });
                setTransactionHash(null);
                refetchTaskDetails();
                refetchAuditorVote();
            }
        },
        enabled: true,
    });

    const isAuditor = task?.auditors?.some(auditor => 
        auditor.toLowerCase() === address?.toLowerCase()
    );

    const { data: auditorVote, refetch: refetchAuditorVote } = useReadContract({
        address: TASK_MARKETPLACE_ADDRESS,
        abi: TASK_MARKETPLACE_ABI,
        functionName: 'auditVotes',
        args: [taskId, address],
        watch: true,
        enabled: !!address && (Number(task?.status) === 3 || Number(task?.status) === 6 || Number(task?.status) === 7) && isAuditor,
    });


    const handleAssignDeveloper = (developerAddress) => {
        writeContract({
            address: TASK_MARKETPLACE_ADDRESS,
            abi: TASK_MARKETPLACE_ABI,
            functionName: 'assignDeveloper',
            args: [taskId, developerAddress],
        });
    };

    const handleStartTask = () => {
        writeContract({
            address: TASK_MARKETPLACE_ADDRESS,
            abi: TASK_MARKETPLACE_ABI,
            functionName: 'startTask',
            args: [taskId],
            value: BigInt(task.reward),
        });
    };

    const handleSubmitWork = () => {
        writeContract({
            address: TASK_MARKETPLACE_ADDRESS,
            abi: TASK_MARKETPLACE_ABI,
            functionName: 'submitWork',
            args: [taskId],
        });
    };

    const handleAcceptWork = () => {
        writeContract({
            address: TASK_MARKETPLACE_ADDRESS,
            abi: TASK_MARKETPLACE_ABI,
            functionName: 'acceptWork',
            args: [taskId],
        });
    };

    const handleWithdraw = () => {
        writeContract({
            address: TASK_MARKETPLACE_ADDRESS,
            abi: TASK_MARKETPLACE_ABI,
            functionName: 'withdrawPayment',
            args: [taskId],
        });
    };

    const handleCheckDeadline = () => {
        writeContract({
            address: TASK_MARKETPLACE_ADDRESS,
            abi: TASK_MARKETPLACE_ABI,
            functionName: 'checkDeadlineAndPenalize',
            args: [taskId],
        });
    };

    const handleInitiateDispute = () => {
        writeContract({
            address: TASK_MARKETPLACE_ADDRESS,
            abi: TASK_MARKETPLACE_ABI,
            functionName: 'initiateDispute',
            args: [taskId],
        });
    };

    const handleSubmitVote = (supportsDeveloper) => {
        writeContract({
            address: TASK_MARKETPLACE_ADDRESS,
            abi: TASK_MARKETPLACE_ABI,
            functionName: 'submitAuditVote',
            args: [taskId, supportsDeveloper],
        });
    };

    const isAssignedDeveloper = address && task?.developer?.toLowerCase() === address.toLowerCase();

    const { data: hasWithdrawn } = useReadContract({
        address: task?.escrowAddress,
        abi: TASK_ESCROW_ABI,
        functionName: 'hasWithdrawn',
        args: [address],
        watch: true,
        enabled: !!task?.escrowAddress && !!address && Number(task?.status) === 4 && isAssignedDeveloper,
    });

    const { data: escrowBalance, refetch: refetchEscrowBalance } = useBalance({
        address: task?.escrowAddress,
        watch: true,
        enabled: !!task?.escrowAddress,
    });

    const { data: developerReward } = useReadContract({
        address: task?.escrowAddress,
        abi: TASK_ESCROW_ABI,
        functionName: 'developerReward',
        watch: true,
        enabled: !!task?.escrowAddress,
    });

    const { data: auditorReward } = useReadContract({
        address: task?.escrowAddress,
        abi: TASK_ESCROW_ABI,
        functionName: 'auditorReward',
        watch: true,
        enabled: !!task?.escrowAddress,
    });

    if (isTaskDetailsLoading) {
        return <div>Loading...</div>;
    }

    const formattedReward = task?.reward ? formatEther(BigInt(task.reward)) : '0';
    const formattedDeadline = task?.deadline 
        ? new Date(Number(task.deadline) * 1000).toLocaleDateString()
        : 'No deadline set';

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

    const isProvider = address && task?.provider?.toLowerCase() === address.toLowerCase();
    const canAssignDeveloper = isProvider && Number(task?.status) === 0;

    const canStartTask = task.developer !== ZERO_ADDRESS && 
        task.auditors?.filter(auditor => auditor !== ZERO_ADDRESS).length >= 3 &&
        Number(task.status) === 0 &&
        isProvider;

    const votedWithMajority = auditorVote && (Number(task?.status) === 6 && auditorVote[1]) || (Number(task?.status) === 7 && !auditorVote[1]);

    const getStartTaskTooltip = () => {
        if (task.developer === ZERO_ADDRESS) {
            return "You need to assign a developer first";
        }
        if (task.auditors?.filter(auditor => auditor !== ZERO_ADDRESS).length < 3) {
            return "You need at least 3 auditors before starting the task";
        }
        if (Number(task.status) !== 0) {
            return "Task cannot be started in its current status";
        }
        if (!isProvider) {
            return "Only the task provider can start the task";
        }
        return `Start the task by paying ${formatEther(BigInt(task.reward))} ETH`;
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-8">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h1 className="text-3xl font-bold">{task.title}</h1>
                        <div className="flex items-center gap-4 mt-2">
                            {getStatusBadge(Number(task.status))}
                            {Number(task.status) === 0 && isProvider && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span>
                                                <Button
                                                    onClick={handleStartTask}
                                                    disabled={!canStartTask || isLoading}
                                                    className="ml-2"
                                                >
                                                    Start Task ({formatEther(BigInt(task.reward))} ETH)
                                                </Button>
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{getStartTaskTooltip()}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                            {Number(task.status) === 1 && isAssignedDeveloper && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span>
                                                <Button
                                                    onClick={handleSubmitWork}
                                                    className="ml-2"
                                                    disabled={isLoading}
                                                >
                                                    Submit Work
                                                </Button>
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Submit your work for review</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                            {Number(task.status) === 2 && isProvider && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span>
                                                <Button
                                                    onClick={handleAcceptWork}
                                                    className="ml-2"
                                                    disabled={isLoading}
                                                >
                                                    Accept Work
                                                </Button>
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Accept the submitted work and release the payment</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                            {Number(task.status) === 4 && (
                                <div className="flex gap-2">
                                    {isAssignedDeveloper && !hasWithdrawn && (
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        onClick={handleWithdraw}
                                                        className="ml-2"
                                                        variant="outline"
                                                        disabled={isLoading}
                                                    >
                                                        Withdraw Developer Reward ({formatEther(BigInt(task.reward))} ETH)
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Withdraw your reward as the winning developer</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    )}
                                </div>
                            )}
                            {Number(task.status) === 6 && (
                                <div className="flex gap-2">
                                    {isAssignedDeveloper && !hasWithdrawn && (
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        onClick={handleWithdraw}
                                                        className="ml-2"
                                                        variant="outline"
                                                        disabled={isLoading}
                                                    >
                                                        Withdraw Developer Reward
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Withdraw your reward as the winning developer</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    )}
                                    {isAuditor && votedWithMajority && !hasWithdrawn && (
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        onClick={handleWithdraw}
                                                        className="ml-2"
                                                        variant="outline"
                                                        disabled={isLoading}
                                                    >
                                                        Withdraw Auditor Reward
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Withdraw your reward for voting correctly</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    )}
                                    {isAuditor && !votedWithMajority && (
                                        <p className="text-red-500">You did not vote for the majority</p>
                                    )}
                                </div>
                            )}
                            {Number(task.status) === 7 && (
                                <div className="flex gap-2">
                                    {isProvider && !hasWithdrawn && (
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        onClick={handleWithdraw}
                                                        className="ml-2"
                                                        variant="outline"
                                                        disabled={isLoading}
                                                    >
                                                        Withdraw Provider Refund ({formatEther(BigInt(task.reward))} ETH)
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Withdraw your refund as the winning provider</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    )}
                                    {isAuditor && votedWithMajority && !hasWithdrawn && (
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        onClick={handleWithdraw}
                                                        className="ml-2"
                                                        variant="outline"
                                                        disabled={isLoading}
                                                    >
                                                        Withdraw Auditor Reward
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Withdraw your reward for voting correctly</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    )}
                                    {isAuditor && !votedWithMajority && (
                                        <p className="text-red-500">You did not vote for the majority</p>
                                    )}
                                </div>
                            )}
                            {Number(task.status) === 1 && isProvider && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span>
                                                <Button
                                                    onClick={handleCheckDeadline}
                                                    className="ml-2"
                                                    variant="destructive"
                                                    disabled={isLoading}
                                                >
                                                    Check Deadline
                                                </Button>
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Check if the deadline has passed and penalize the developer if necessary</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                            {Number(task.status) === 2 && (isProvider || isAssignedDeveloper) && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span>
                                                <Button
                                                    onClick={handleInitiateDispute}
                                                    className="ml-2"
                                                    variant="destructive"
                                                    disabled={isLoading}
                                                >
                                                    Initiate Dispute
                                                </Button>
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Open a dispute for this task</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                            {Number(task.status) === 3 && isAuditor && auditorVote && !auditorVote[0] && (
                                <div className="flex gap-2">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    onClick={() => handleSubmitVote(true)}
                                                    className="ml-2"
                                                    variant="outline"
                                                    disabled={isLoading}
                                                >
                                                    Vote for Developer
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Vote in favor of the developer</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>

                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    onClick={() => handleSubmitVote(false)}
                                                    className="ml-2"
                                                    variant="outline"
                                                    disabled={isLoading}
                                                >
                                                    Vote for Provider
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Vote in favor of the provider</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <p className="text-gray-600 text-lg">{task.description}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Task Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <h3 className="text-sm font-medium text-gray-500">Reward</h3>
                                <p className="text-2xl font-bold">{formattedReward} ETH</p>
                                {Number(task.status) !== 0 && task.escrowAddress && task.escrowAddress !== ZERO_ADDRESS && (
                                    <div className="mt-2">
                                        <h3 className="text-sm font-medium text-gray-500">Escrow Contract</h3>
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-2">
                                                <p className="font-mono text-sm bg-gray-50 p-2 rounded" title={task.escrowAddress}>
                                                    {truncateAddress(task.escrowAddress)}
                                                </p>
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 w-8 p-0"
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(task.escrowAddress);
                                                                    toast({
                                                                        title: "Copied!",
                                                                        description: "Escrow address copied to clipboard",
                                                                        duration: 2000,
                                                                    });
                                                                }}
                                                            >
                                                                <CopyIcon className="h-4 w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>Copy escrow address</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div>
                                <h3 className="text-sm font-medium text-gray-500">Deadline</h3>
                                <p className="text-lg">{formattedDeadline}</p>
                            </div>
                        </CardContent>
                    </Card>

                    {task?.escrowAddress && (
                        <Card className="mb-4">
                            <CardHeader>
                                <CardTitle>Escrow Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">Contract Balance:</span>
                                        <span>{escrowBalance ? formatEther(escrowBalance.value) : '0'} ETH</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">Developer Reward:</span>
                                        <span>{developerReward ? formatEther(developerReward) : '0'} ETH</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">Auditor Reward:</span>
                                        <span>{auditorReward ? formatEther(auditorReward) : '0'} ETH</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle>Participants</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <h3 className="text-sm font-medium text-gray-500">Provider</h3>
                                <p className="font-mono bg-gray-50 p-2 rounded" title={task.provider}>
                                    {truncateAddress(task.provider)}
                                </p>
                            </div>
                            {task.developer && task.developer !== ZERO_ADDRESS && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500">Assigned Developer</h3>
                                    <p className="font-mono bg-gray-50 p-2 rounded" title={task.developer}>
                                        {truncateAddress(task.developer)}
                                    </p>
                                </div>
                            )}
                            {task.auditors && task.auditors.length > 0 && task.auditors.some(auditor => auditor !== ZERO_ADDRESS) && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500">Auditors</h3>
                                    <div className="space-y-2">
                                        {task.auditors
                                            .filter(auditor => auditor !== ZERO_ADDRESS)
                                            .map((auditor, index) => (
                                                <p key={index} className="font-mono bg-gray-50 p-2 rounded" title={auditor}>
                                                    {truncateAddress(auditor)}
                                                </p>
                                            ))
                                        }
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {developerCandidates && 
                 developerCandidates.length > 0 && 
                 task.developer === ZERO_ADDRESS && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Developer Candidates</CardTitle>
                            <p className="text-sm text-gray-500">
                                {developerCandidates.length} candidate{developerCandidates.length > 1 ? 's' : ''} available
                            </p>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {developerCandidates.map((developer, index) => (
                                    <div 
                                        key={index} 
                                        className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                                <p className="font-mono text-sm" title={developer}>
                                                    {truncateAddress(developer)}
                                                </p>
                                                <DeveloperStats address={developer} />
                                            </div>
                                            {canAssignDeveloper && (
                                                <Button 
                                                    onClick={() => handleAssignDeveloper(developer)}
                                                    size="sm"
                                                    className="ml-4 shrink-0"
                                                    disabled={isLoading}
                                                >
                                                    Assign Developer
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
};

export default TaskPage; 