#!/bin/bash

echo "
apiVersion: v1
kind: ServiceAccount
metadata:
  name: $NAME-account
" > service_account.yaml
kubectl create -f service_account.yaml
rm service_account.yaml

secrets=$(kubectl get ServiceAccount $NAME-account  -o jsonpath='{.secrets[0].name}')
token=$(kubectl get secrets ${secrets} -o jsonpath='{.data.token}' | base64 --decode)
cluster_name=$(kubectl config current-context)
echo $cluster_name
certificate=$(kubectl config view --flatten -o jsonpath="{.clusters[?(@.name == '$cluster_name')].cluster.certificate-authority-data}")
server_ip=$(kubectl config view --flatten -o jsonpath="{.clusters[?(@.name == '$cluster_name')].cluster.server}")

echo "
kind: ClusterRole
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: $NAME-role
rules:
- apiGroups:
  - '*'
  resources:
  - '*'
  verbs:
  - '*'
- nonResourceURLs:
  - '*'
  verbs:
  - '*'
" > role.yaml
kubectl apply -f role.yaml
rm role.yaml

echo "
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: $NAME-role-binding
subjects:
- kind: ServiceAccount
  name: $NAME-account
  namespace: default
  apiGroup: ""
roleRef:
  kind: ClusterRole
  name: $NAME-role
  apiGroup: rbac.authorization.k8s.io
" > role_binding.yaml
kubectl apply -f role_binding.yaml
rm role_binding.yaml

echo "
apiVersion: v1
kind: Config
users:
- name: $NAME-account
  user:
    token: ${token}
clusters:
- cluster:
    certificate-authority-data: $certificate
    server: ${server_ip}
  name: ${cluster_name}
contexts:
- context:
    cluster: ${cluster_name}
    user: $NAME-account
  name: $NAME-account-context
current-context: $NAME-account-context
" > config.yaml