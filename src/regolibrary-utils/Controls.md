## Controls

Kubescape comes with tens of controls that can be used in any framework. The controls are tests that look at a certain aspect of your cluster. The different aspects that Kubescape examines:

- K8s configuration – any YAML file, any resource that the API server exposes.
- API server settings – Kubescape looks at the API server settings.
- Worker node – Kubescape looks at the configuration of the worker node. Things like Kubelet configuration, host settings, etc.
- Image scanning – Kubescape looks at the image scanning result and gives you high-level visibility to items you need to pay attention to.

While most of the controls are looking for specific parameters and their values which are predefined and determined by Kubernetes, some of the controls look for certain values which change from cluster to cluster or from one environment to the other.  
Kubescape supports the ability to personalize some controls by changing the parameters of the controls. This can be done from the Cloud Platform or the CLI.  
Kubescape marks these controls as part of the scan report:

![](f57c647-5.PNG "5.PNG")



It is important to adjust these controls to your specific use case as it might lead to false positive results.

## Adjusting the control to your needs

Kubescpae enables you to set these controls based on your deployment. You can do it in the Cloud Platform or the CLI. 

## Kubescape Cloud Platform

Go to settings->controls. Check the “show configuration controls only”. Open the control by clicking on the icon on the right side of the control ID.

![](c27e133-6.PNG "6.PNG")



You can add/remove parameters.

## Kubescape CLI

You can do the same thing using Kubescape CLI.

- Run ‘kubescape download controls-inputs’  
  You will get the file location that contains all the controls and their default settings. Open the file and set the parameters you would like to add/remove. 

Run Kubescape scan as you are used to, but add the following flag: ‘--controls-config <path to file you edited>’ 

![](ff78aa5-7.PNG "7.PNG")