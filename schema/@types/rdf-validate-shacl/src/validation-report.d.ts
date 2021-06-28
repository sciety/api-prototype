import { BlankNode, DataFactory, DatasetCore, DatasetCoreFactory, NamedNode, Quad, Term } from 'rdf-js';
import { GraphPointer } from 'clownface';

declare namespace ValidationReport {
    interface Options<F extends DataFactory & DatasetCoreFactory> {
        factory: F;
    }

    interface ValidationResult<D extends DatasetCore> {
        term: BlankNode | NamedNode;
        dataset: D;
        cf: GraphPointer<Term, D>;
        readonly message: Term[];
        readonly path: BlankNode | NamedNode | null;
        readonly focusNode: BlankNode | NamedNode | null;
        readonly severity: NamedNode | null;
        readonly sourceConstraintComponent: BlankNode | NamedNode | null;
        readonly sourceShape: BlankNode | NamedNode | null;
    }
}

declare class ValidationReport<OutQuad extends Quad = Quad, InQuad extends Quad = OutQuad, D extends DatasetCore<OutQuad, InQuad> = DatasetCore<OutQuad, InQuad>, F extends DataFactory<OutQuad, InQuad> & DatasetCoreFactory<OutQuad, InQuad, D> = DataFactory<OutQuad, InQuad> & DatasetCoreFactory<OutQuad, InQuad, D>> {
    constructor(resultQuads: InQuad[], options: ValidationReport.Options<F>);
    term: BlankNode | NamedNode;
    dataset: D;
    conforms: boolean;
    results: ValidationReport.ValidationResult<D>[];
}

export = ValidationReport;
