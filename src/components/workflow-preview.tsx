const stages = [
  { id: 'reference', title: 'Reference ad', description: 'Start with a concept you have permission to use.', alt: 'Fictional man holding a blue bottle in a cool-toned reference ad.' },
  { id: 'product', title: 'Your product', description: 'Bring the product you want to put in the spotlight.', alt: 'Amber glass product bottle with a cream cap and blank ivory label.' },
  { id: 'cast', title: 'New cast', description: 'Choose an original character for your story.', alt: 'Fictional woman with curly dark hair wearing a terracotta linen top.' },
  { id: 'direction', title: 'New direction', description: 'Plan a distinct scene with your product and cast.', alt: 'The same fictional woman holding the amber bottle in a warm sunlit setting.' },
] as const;

export function WorkflowPreview() {
  return <section className="workflow-preview" aria-labelledby="workflow-title">
    <div className="workflow-heading">
      <p className="eyebrow">THE SPARK IS JUST THE START</p>
      <h2 id="workflow-title">Their concept.<br/><em>Your own direction.</em></h2>
      <p>A new product. An original cast. A scene that feels like your brand.</p>
    </div>
    <ol className="workflow-panels">
      {stages.map((stage, index) => <li key={stage.id}>
        <div className="workflow-stage"><span aria-hidden="true">0{index + 1}</span><h3>{stage.title}</h3></div>
        <img src={`/assets/workflow/${stage.id}.webp`} width={405} height={922} loading="lazy" decoding="async" alt={stage.alt}/>
        <p>{stage.description}</p>
      </li>)}
    </ol>
    <p className="workflow-disclosure">Illustrative workflow · fictional people and products · not VIDZO video output</p>
  </section>;
}
