/* ----------------------------------- K8S --------------------------------- */

export type HwSpec = {
  cpu: number; // 'm'
  gpu: number;
  memory: number; // 'Mi'
};

export type k8sHwSpec = {
  cpu: string; // 'm'
  'nvidia.com/gpu': string;
  memory: string; // 'Mi'
};

export type HwStatus = {
  capacity: HwSpec,
  allocatable: HwSpec
}

export type ContainerSpec = {
  imagePath: string, // DOCKER IMAGE URL
  resourceLimits: HwSpec,
  env?: Object, // { ENV_NAME: ENV_VALUE }
  ports?: number[], // Internal Port List
}

export type StorageSpecs = {
  [storageId: string]: {
    mountPath: string, // to Container
  }
}

export type SecretSpecs = {
  [secretId: string]: {
    mountPath: string, // to Container
  }
}

/*
  Available -- a free resource that is not yet bound to a claim
  Bound     -- the volume is bound to a claim
  Released  -- the claim has been deleted, but the resource is not yet reclaimed by the cluster
  Failed    -- the volume has failed its automatic reclamation
*/
export type StorageStatus = 'Available' | 'Bound' | 'Released' | 'Failed';

/*
  Pending --  The Pod has been accepted by the Kubernetes cluster,
              but one or more of the containers has not been set up and made ready to run.
              This includes time a Pod spends waiting to be scheduled as well as
              the time spent downloading container images over the network.
  Running --  The Pod has been bound to a node, and all of the containers have been created.
              At least one container is still running, or is in the process of
              starting or restarting.
              Succeeded All containers in the Pod have terminated in success,
              and will not be restarted.
  Failed  --  All containers in the Pod have terminated,
              and at least one container has terminated in failure.
              That is, the container either exited with non-zero status or
              was terminated by the system.
  Unknown --  For some reason the state of the Pod could not be obtained.
              This phase typically occurs due to an error in communicating
              with the node where the Pod should be running.
*/
export type PodPhase = 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown';

/*
  PodScheduled    -- the Pod has been scheduled to a node.
  ContainersReady -- all containers in the Pod are ready.
  Initialized     -- all init containers have started successfully.
  Ready           -- the Pod is able to serve requests and should be added to
                     the load balancing pools of all matching Services.
*/
export type PodCondition = 'Initialized' | 'Ready' | 'ContainersReady' | 'PodScheduled';

export type PodInfo = {
  allResourcelimits: HwSpec,
  targetNodeName: string,
  isConnectPod: boolean,
  containerId: string,
  name: string,
  namespaceId: string,
  status: {
    phase: PodPhase,
    message?: string
    startTime?: string
    condition?: {
      type: PodCondition,
      status: boolean, // If success then true.
      reason?: string,
      message?: string,
    }
  }
}

export type NodePool = {
  [nodePoolName: string]: {
    gpu: string,
    osImage: string,
    nodes: {
      [nodeId: string]: HwStatus
    }
  }
};

export type StorageInfo = {
  storageId: string,
  status: StorageStatus,
  claim?: {
    name: string,
    namespaceId: string,
  },
}

export type GatewayPort = {
  number: number,
  name: string,
  protocol: string,
}

export type Resource = 'namespace' | 'deployment' | 'service' | 'virtualService' | 'storage';
