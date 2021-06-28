// Type definitions for rdf-validate-shacl 0.2
// Project: https://github.com/zazuko/rdf-validate-shacl#readme
// Definitions by: Tomasz Pluskiewicz <https://github.com/tpluscode>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

declare module 'rdf-validate-shacl' {

    import { DataFactory, DatasetCore, DatasetCoreFactory, Quad } from 'rdf-js';
    import ValidationReport = require('./src/validation-report');

    declare namespace SHACLValidator {
        interface Options<F extends DataFactory & DatasetCoreFactory> {
            factory?: F;
            maxErrors?: number;
        }
    }

    declare class SHACLValidator<OutQuad extends Quad = Quad, InQuad extends Quad = OutQuad, D extends DatasetCore<OutQuad, InQuad> = DatasetCore<OutQuad, InQuad>, F extends DataFactory<OutQuad, InQuad> & DatasetCoreFactory<OutQuad, InQuad, D> = DataFactory<OutQuad, InQuad> & DatasetCoreFactory<OutQuad, InQuad, D>> {
        constructor(shapes: D, options?: SHACLValidator.Options<F>);
        factory: F;
        depth: number;
        validate(data: D): ValidationReport<OutQuad, InQuad, D, F>;
        nodeConformsToShape(focusNode: OutQuad['subject'], shapeNode: OutQuad['subject']): boolean;
    }

    export = SHACLValidator;

}
